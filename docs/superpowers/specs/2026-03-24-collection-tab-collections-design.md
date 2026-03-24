# Collection Tab — Show Owned Collections

## Problem

When a user pulls a collection card from a pack, it appears in their binder/trading/marketplace but NOT in the Collection tab (CCCollection.jsx). The Collection tab only shows game cards (gods, items, consumables) and player cards.

## Solution

Add collection sections to the Collection tab. If a user owns at least one card minted from a collection, that collection appears as a navigable section. Within the section, show every template in the collection with owned rarities highlighted and unowned greyed out — same UX as game cards.

---

## 1. Backend — New Endpoint

**Action:** `collection-collections` in `functions/api/vault.js`

Returns collections the user has cards from, plus ownership data.

### Query Logic

```sql
-- Step 1: Get distinct collection IDs the user has cards from
SELECT DISTINCT ce.collection_id
FROM cc_cards c
JOIN cc_collection_entries ce ON ce.template_id = c.template_id
WHERE c.owner_id = $userId AND c.card_type = 'collection'

-- Step 2: For each collection, get metadata + all entries
SELECT col.id, col.name, col.description, col.cover_image_url,
       ce.template_id, ce.draft_id,
       COALESCE(t.name, d.name) AS template_name,
       COALESCE(t.card_type, d.card_type) AS card_type,
       COALESCE(t.template_data, d.template_data) AS template_data
FROM cc_collections col
JOIN cc_collection_entries ce ON ce.collection_id = col.id
LEFT JOIN cc_card_templates t ON t.id = ce.template_id
LEFT JOIN cc_card_drafts d ON d.id = ce.draft_id
WHERE col.id = ANY($collectionIds) AND col.status = 'active'

-- Step 3: Ownership map — which templates the user owns and at which rarities
SELECT c.template_id, array_agg(c.rarity) AS rarities
FROM cc_cards c
WHERE c.owner_id = $userId AND c.card_type = 'collection' AND c.template_id IS NOT NULL
GROUP BY c.template_id
```

### Response Shape

```json
{
  "collections": [
    {
      "id": 1,
      "name": "Starter Pack",
      "description": "First collection",
      "coverImageUrl": "https://...",
      "entries": [
        {
          "templateId": 5,
          "name": "Dragon Spirit",
          "cardType": "collection",
          "templateData": { "elements": [...], "border": {...} }
        }
      ]
    }
  ],
  "owned": {
    "5": ["epic", "rare"],
    "12": ["common"]
  }
}
```

### Template Cache

The response includes `templateData` for each entry. On the frontend, merge these into the VaultContext `templateCache` so `VaultCard`/`CanvasCard` can render them. Use the existing `mergeInlineTemplates` pattern — or just set them directly since we control the response.

---

## 2. Frontend — CCCollection.jsx Changes

### New Section Type

Add collection sections alongside `GAME_SECTIONS` and player sets.

**Navigation:** Each owned collection becomes a nav item in the sidebar (desktop) and pill strip (mobile). Placed after game card sections and before player sets.

**Section key format:** `collection-${collectionId}` (e.g., `collection-1`)

### Data Loading

Add to the existing `Promise.all` on mount:
```js
vaultService.getOwnedCollections()
```

Returns the response from `collection-collections` endpoint. Store in new state: `const [collectionSets, setCollectionSets] = useState(null)`.

### Collection Section Rendering

New component `CollectionCardGrid` (internal to CCCollection.jsx or a sub-file):
- Takes: `{ collection, owned, templateCache, onZoom }`
- Shows collection name/description header
- Grid of cards — one per template entry
- Each card: if owned at any rarity, show `VaultCard` with rarity pips; if not owned, show placeholder
- Rarity pips show which rarities are owned (same as game cards)
- Click → CardZoomModal with `collectionCard` prop

### Owned/Unowned UX

Same pattern as game cards:
- **Owned template:** Renders `VaultCard` with highest owned rarity. Rarity pip dots below. Duplicate count badge if >1 of same rarity.
- **Unowned template:** Greyed placeholder with template name and "???" — does NOT reveal the card design (keeps discovery exciting).

### CardZoomModal Integration

When zooming a collection card:
```js
onZoom({
  collectionCard: { templateId, rarity, ...card },
  ownedRarities: owned[templateId] || [],
  canSell: true
})
```

### Filtering & Sorting

Collection sections respect the existing viewMode (all/owned), rarity filter, and search query. Sort modes apply within each collection's card list.

---

## 3. Frontend Service

Add to `vaultService` in `src/services/database.js`:

```js
async getOwnedCollections() {
  return apiCall('vault', { action: 'collection-collections' })
}
```

---

## 4. Sidebar/Nav Changes

### Desktop Sidebar

Add "Collections" header section between game cards and player sets:
```
Game Cards
  ⚔ Gods (12/45)
  🛡 Items (8/30)
  🧪 Consumables (3/15)

Collections          ← new
  📦 Starter Pack    ← new (one per owned collection)
  📦 Season 1 Promo  ← new

Player Sets
  OSL · Division 1 · Season 1
  ...
```

Show collected/total count per collection (e.g., "3/7").

### Mobile Pills

Add collection pills after game card pills and before player pills. Same order.

---

## 5. File Summary

| Action | File |
|--------|------|
| **Modify** | `functions/api/vault.js` — add `handleCollectionCollections` |
| **Modify** | `src/services/database.js` — add `getOwnedCollections` |
| **Modify** | `src/pages/vault/CCCollection.jsx` — add collection sections, nav items, grid |
| **Total files** | 3 |

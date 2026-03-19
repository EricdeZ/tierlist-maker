# Vault Collections System — Design Spec

## Overview

Collections bridge approved studio card designs into the pack system. A collection is a curated group of approved templates. Packs gain a new `collection` slot type that draws cards from a specific collection, rolling rarity at open time. Every rarity variant renders using StructuredCard (the same renderer as the studio rarity strip preview).

## Database Schema

### New Tables

**`cc_collections`**
```sql
CREATE TABLE cc_collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft, active, archived
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cc_collections_status ON cc_collections(status);
```

**`cc_collection_entries`**
```sql
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

Note: `ON DELETE RESTRICT` on template_id prevents deleting templates that are in a collection. Admin must remove the entry first.

### Existing Table Changes

**`cc_cards`** — no schema change. The `template_id` FK already exists. Collection cards use:
- `card_type = 'collection'`
- `template_id` — FK to the source template
- `rarity` — rolled at pack-open time
- `holo_effect`, `holo_type` — from existing rarity mappings
- `card_data` — `{ collectionId, collectionName }` for display context
- `serial_number` — random (same approach as existing cards: `Math.floor(Math.random() * 9999) + 1`)
- Legacy NOT NULL columns: `god_id` = `'collection-{template_id}'`, `god_name` = template name, `god_class` = template card_type, `role` = `'collection'`

**`cc_pack_types.slots`** — new slot type. Each slot produces exactly 1 card (consistent with all other slot types):
```json
{ "type": "collection", "collectionId": 5 }
```
To include 2 collection cards from the same collection, add 2 slots.

## Pack Generation

When the generator encounters a collection slot:

1. Fetch entries from `cc_collection_entries` joined with `cc_card_templates` where `collection.status = 'active'` AND `template.status = 'approved'`
2. If 0 valid entries, skip the slot (pack has fewer cards, no crash)
3. Pick 1 random template from the entries
4. Roll rarity via existing `rollRarity()`
5. Insert into `cc_cards`:
   - `card_type: 'collection'`
   - `template_id` — **must be added to the INSERT column list** in `openPack` (`functions/lib/vault.js`)
   - `god_id: 'collection-{template_id}'`, `god_name: template.name`, `god_class: template.card_type`, `role: 'collection'`
   - Rolled rarity, holo_effect, holo_type
   - `card_data: { collectionId, collectionName }`
   - `acquired_via: 'pack'`
6. First-edition check: expand the existing condition from `card.card_type === 'player' && !!card.def_id` to also include `card.card_type === 'collection' && !!card.template_id`. The existence check uses `template_id` + `rarity` combo.
7. Serial number: random (`Math.floor(Math.random() * 9999) + 1`), same as other card types

### Required changes to openPack INSERT

The INSERT statement in `functions/lib/vault.js:447` must add `template_id` to its column list. Currently it inserts: `owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, is_first_edition`. Add `template_id` (NULL for non-collection cards, set for collection cards).

Existing god/item/consumable/player slot generation is completely untouched.

## Card Rendering Pipeline

### Defensive Rendering Principle

If template data is missing, malformed, or the cache fetch failed — render an empty placeholder, never crash. No location should throw due to a collection card.

### Template Data Delivery

**Two delivery paths** to avoid waterfall requests:

1. **Initial load** — the `handleLoad` response in `vault.js` detects collection cards in the user's owned cards, fetches their template data server-side, and includes it as `templateCache: { [id]: { cardData, cardType, border } }` in the response. Zero extra round trips.

2. **New cards arriving** (pack open, gift, trade) — the pack open / gift open response already returns card objects. For collection cards, include a `_templateData` field inline on the card object. VaultContext merges these into the cache on arrival.

**VaultContext stores `templateCache`** as state, exposed via `getTemplate(id)`. If cache is empty or a template_id is missing, rendering falls back to EmptyCardSlot.

**Public pages** (CardSharePage, BinderSharePage) don't use VaultContext. Their backend endpoints (`shared-card`, `binder-view`) must include template data inline for any collection cards in the response.

### Template Cache Shape (minimal)
```js
{
  [templateId]: {
    cardData,   // name, imageUrl, serialNumber, role, blocks, subtitle, etc.
    cardType,   // 'player', 'god', 'custom', etc.
    border,     // { enabled, color, width, radius }
  }
}
```

### Required changes to formatCard

`formatCard` in `functions/api/vault.js` must map `template_id` → `templateId` in its output. Every callsite (10+) benefits automatically.

### Rendering Decision Flow

Every card render location uses:
```
card_type === 'collection' && template_id present?
  → look up templateCache[template_id]
  → if found: StructuredCard (with card's rolled rarity)
  → if not found: EmptyCardSlot placeholder
card_type === 'player'?
  → TradingCard (unchanged)
else?
  → GameCard (unchanged)
```

### VaultCard Wrapper Component

New component encapsulating the three-way routing. Wrapped in a React error boundary that catches render-phase crashes and shows EmptyCardSlot — this is the real safety net (try/catch around JSX won't catch React render errors).

```jsx
// Error boundary wraps all StructuredCard renders
<CardErrorBoundary fallback={<EmptyCardSlot rarity={card.rarity} />}>
  <StructuredCard cardData={template.cardData} rarity={card.rarity} cardType={template.cardType} size={size} />
</CardErrorBoundary>
```

Full component:
```jsx
function VaultCard({ card, size, holo, override }) {
  // collection card path
  if (card.cardType === 'collection' && card.templateId) {
    const template = getTemplate(card.templateId)
    if (!template?.cardData) return <EmptyCardSlot rarity={card.rarity} />
    const structured = (
      <CardErrorBoundary fallback={<EmptyCardSlot rarity={card.rarity} />}>
        <StructuredCard cardData={template.cardData} rarity={card.rarity} cardType={template.cardType} size={size} />
      </CardErrorBoundary>
    )
    if (holo) {
      return (
        <TradingCardHolo rarity={getHoloEffect(card.rarity)} holoType={card.holoType} size={size}>
          {structured}
        </TradingCardHolo>
      )
    }
    return structured
  }
  // player card path (unchanged)
  if (isPlayerCard(card)) return <TradingCard ... />
  // game card path (unchanged)
  return <GameCard ... />
}
```

### EmptyCardSlot

Styled div matching GameCard dimensions with rarity border color and muted "Card" text. Looks intentional, not broken.

### Holo Wrapping Per Location

Holo (TradingCardHolo) only in interactive/detail contexts:

| Location | Holo | Notes |
|----------|------|-------|
| Pack opening (reveal + summary) | Yes | TradingCardHolo wraps StructuredCard |
| Card zoom modal | Yes | Full interactive tilt |
| Starting Five | Yes | Display cards |
| Card share page | Yes | Public share link |
| Collection grid | No | Browse view |
| Binder | No | Compact cards |
| Dismantle grid | No | Selection view |
| Trading offers | No | List view |
| Marketplace grid | No | Browse view |
| Binder share page | No | Compact view |

### Locations To Patch (~15 files)

Each location's card type switch needs the collection branch added:

1. `PackOpening.jsx` — PackCard + SummaryView
2. `CardZoomModal.jsx` — new `collectionCard` prop branch
3. `CCCollection.jsx` — collection grid
4. `CCCardCatalog.jsx` — catalog view
5. `CCStartingFive.jsx` — slotted cards
6. `CCBinder.jsx` — binder slots
7. `CCDismantle.jsx` — dismantle grid
8. `CCTrading.jsx` — trade offers
9. `CCMarketplace.jsx` — marketplace listings
10. `CCBlackMarket.jsx` — bounty rewards
11. `CCBountyBoard.jsx` — bounty listings
12. `CardSharePage.jsx` — public share (template data inlined by backend)
13. `BinderSharePage.jsx` — binder share (template data inlined by backend)
14. `CCSignatureRequests.jsx` — signature display
15. `VaultOverview.jsx` (dashboard) — card preview

### Pack Opening Special Handling

If a collection card's template can't be resolved during pack reveal, show the card back image instead of crashing the reveal sequence. The card exists in cc_cards and will render properly once the template cache is populated.

## Collection Card In Collection Array

Same shape as other cards, with additions:
```js
{
  id: 999,
  cardType: 'collection',
  templateId: 42,
  rarity: 'epic',
  holoEffect: 'cosmos',
  holoType: 'reverse',
  serialNumber: '003',
  isFirstEdition: false,
  cardData: { collectionId: 5, collectionName: 'Season 2 All-Stars' },
}
```

## Admin Interface

### Collection Manager (`/vault-dashboard/collections`)

**List view:**
- Table: name, status badge, entry count, created by, date
- Filter by status (draft/active/archived)
- Create new collection button

**Collection editor:**
- Name, description, cover image fields
- Status control (draft → active → archived)
- **Card browser panel** — searchable list of approved templates (reuse existing `GET ?action=templates&status=approved` with additional filters):
  - Filters: card type, rarity, name search
  - Bulk select: checkbox per card, "Add all matching" button
  - Cherry-pick: individual selection
- **Current entries panel** — cards in collection, with remove button

### Pack Type Editor

Existing pack slot configuration gains:
- New slot type option: "Collection"
- Collection dropdown (active collections only)
- Each slot = 1 card (add multiple slots for multiple collection cards)

### Permissions

Reuse `vault_approve` — same people who approve templates manage collections and pack config.

## API Endpoints

### Collection Management (vault-dashboard.js)

- `GET ?action=collections` — list collections (with entry counts)
- `GET ?action=collection&id=X` — single collection with full entries
- `POST ?action=save-collection` — create/update collection (name, description, cover, status)
- `POST ?action=add-collection-entries` — add template_ids to collection (bulk)
- `POST ?action=remove-collection-entry` — remove single entry
- `POST ?action=collection-status` — change status (draft/active/archived)

### Template Data (vault.js)

Template data is delivered inline — no separate endpoint needed:
- `handleLoad` includes `templateCache` for all owned collection cards
- Pack open / gift open responses include `_templateData` on collection card objects
- `shared-card` and `binder-view` endpoints include template data inline for collection cards

### Approved Templates Browse (vault-dashboard.js)

Reuse existing `GET ?action=templates&status=approved` — no new endpoint needed. The collection editor's card browser calls this with additional query params for filtering.

## What Stays Unchanged

- God/item/consumable static card generation
- Player card generation from cc_player_defs
- rollRarity() weights and holo mappings
- Existing pack types and their slots
- Pack opening UI flow and animations
- TradingCard and GameCard components (no modifications)
- StructuredCard component (no modifications, already handles all card types)

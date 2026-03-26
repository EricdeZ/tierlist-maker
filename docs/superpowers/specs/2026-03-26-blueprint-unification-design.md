# Blueprint Unification Design

## Problem

Two design flaws in the vault card system:

1. **`card_type='collection'` is wrong.** Collection is a grouping mechanism, not a card type. Cards minted from collections should have their actual type (staff, god, etc.), not "collection". The card's origin is metadata, not its identity.

2. **Templates and drafts are the same thing.** `cc_card_templates` and `cc_card_drafts` have the same columns, the same approval workflow, the same status lifecycle. The distinction is artificial. Furthermore, `cc_cards.template_id` only tracks template-sourced cards — draft-sourced cards lose their lineage entirely (`template_id = NULL`).

## Solution

Merge `cc_card_templates` + `cc_card_drafts` into a single **`cc_card_blueprints`** table. Cards minted from collections get their real `card_type` from the blueprint. All cards trace back to their source via `blueprint_id`.

## Database Migration

### New table: `cc_card_blueprints`

Superset of both old tables' columns:

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | SERIAL | NO | PK | New IDs, not reusing old |
| name | TEXT | NO | | From templates.name or drafts.notes |
| description | TEXT | YES | | From templates.description |
| card_type | TEXT | NO | | staff, god, player, etc. |
| rarity | TEXT | NO | | |
| status | TEXT | NO | 'draft' | draft/pending_review/approved/rejected/archived |
| template_data | JSONB | NO | '{}' | Elements, border, cardData |
| thumbnail_url | TEXT | YES | | |
| target_player_id | INTEGER | YES | | Carried over from drafts |
| rejection_reason | TEXT | YES | | |
| depicted_user_id | INTEGER | YES | | FK -> users (ON DELETE SET NULL) |
| created_by | INTEGER | YES | | FK -> users |
| approved_by | INTEGER | YES | | FK -> users |
| approved_at | TIMESTAMPTZ | YES | | |
| source | TEXT | NO | | 'template' or 'draft' — origin table |
| legacy_template_id | INTEGER | YES | | Original cc_card_templates.id |
| legacy_draft_id | INTEGER | YES | | Original cc_card_drafts.id |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

**Indexes:** status, created_by, (status, created_by) — matching existing patterns.

### Data backfill

1. Copy all rows from `cc_card_templates` into `cc_card_blueprints` with `source='template'`, `legacy_template_id = id`, `name = name`.
2. Copy all rows from `cc_card_drafts` into `cc_card_blueprints` with `source='draft'`, `legacy_draft_id = id`, `name = COALESCE(notes, 'Untitled')`.

### Modified tables

**`cc_collection_entries`:**
- Add `blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE RESTRICT`
- Backfill: For template_id entries, look up blueprint by `legacy_template_id`. For draft_id entries, look up by `legacy_draft_id`.
- Old columns (`template_id`, `draft_id`) remain, XOR constraint remains.

**`cc_cards`:**
- Add `blueprint_id INTEGER REFERENCES cc_card_blueprints(id) ON DELETE SET NULL`
- Backfill `blueprint_id`: For cards with `template_id`, look up blueprint by `legacy_template_id`.
- Backfill `blueprint_id` for draft-sourced cards: Join through `cc_collection_entries` where `card_data->>'collectionId'` matches and `draft_id` is set, then look up blueprint by `legacy_draft_id`. (These previously had `template_id = NULL` and lost their lineage.)
- Backfill `card_type`: For all cards where `card_type = 'collection'` AND `blueprint_id` is now set, update `card_type` to the blueprint's `card_type`.
- Old `template_id` column remains.

**`cc_promo_gifts`:**
- Add `blueprint_id INTEGER REFERENCES cc_card_blueprints(id)`
- Backfill from `template_id` via `legacy_template_id` lookup.
- Old `template_id` column remains.

### Old tables untouched

`cc_card_templates` and `cc_card_drafts` remain in the database with all data intact. No drops.

## Backend Changes

### `functions/lib/vault.js`

**`generateCollectionCard()`:**
- Query changes from COALESCE/LEFT JOIN on two tables to a single join: `cc_collection_entries.blueprint_id` -> `cc_card_blueprints`.
- Set `card_type` from blueprint's `card_type` (not hardcoded `'collection'`).
- Always set `blueprint_id` on the returned card object.

**Card insertion (INSERT INTO cc_cards):**
- Write `blueprint_id` instead of `template_id`.
- Set `god_id` to `blueprint-{id}` instead of `collection-{id}`.
- First-edition check: `blueprint_id = X` instead of `card_type = 'collection' AND template_id = X`.

### `functions/api/vault.js`

- **Binder endpoint:** Join on `blueprint_id` -> `cc_card_blueprints` instead of `template_id` -> `cc_card_templates`.
- **Collection ownership endpoint:** Change `WHERE card_type = 'collection' AND template_id IS NOT NULL` to `WHERE blueprint_id IS NOT NULL`, join through `cc_collection_entries.blueprint_id`.
- **Collection showcase endpoint:** Join `cc_collection_entries.blueprint_id` -> `cc_card_blueprints`.
- **Promo gift endpoints:** Use `blueprint_id` everywhere.
- **Valid card types:** Remove `'collection'` from the valid types array.
- **`formatCard()`:** Return `blueprintId` instead of `templateId`.

### `functions/api/vault-dashboard.js`

- All template/draft CRUD operations now operate on `cc_card_blueprints` as a single table.
- No more dynamic table selection (`cc_card_templates` vs `cc_card_drafts`).
- `addCollectionEntries()`: Write `blueprint_id` instead of separate `template_id`/`draft_id`.
- `getCollection()` entries: Simple join on `blueprint_id` instead of COALESCE/LEFT JOIN.
- No more `source_type` derivation.

### `functions/api/vault-dashboard-upload.js`

- Thumbnail upload writes to `cc_card_blueprints` instead of dynamic table selection.

## Frontend Changes

### Data shape

API responses return `blueprintId` instead of `templateId`. Pre-loaded design data uses `_blueprintData` instead of `_templateData`.

### Core rendering check

`!!card.blueprintId` replaces `!!card.templateId` as the check for "render this card via VaultCard with blueprint design data." The rendering pipeline (VaultCard -> CanvasCard/StructuredCard) is unchanged.

`card.cardType` no longer returns `'collection'` — it returns the real type (staff, god, etc.).

### Component updates

| Component | Changes |
|-----------|---------|
| VaultCard.jsx | Props: `templateId` -> `blueprintId`, `getTemplate` -> `getBlueprint`, `_templateData` -> `_blueprintData` |
| CCBinder.jsx | `!!card.templateId` -> `!!card.blueprintId`, template cache -> blueprint cache |
| CCCollection.jsx | No change needed — `COLLECTION_TYPES` stays `['god', 'item', 'consumable']` (game-data cards). Blueprint-sourced cards (staff, custom, etc.) appear in binder/marketplace, not this tab. |
| CCMarketplace.jsx | `card.templateId` -> `card.blueprintId` |
| CCDismantle.jsx | `card.templateId` -> `card.blueprintId` |
| CCStartingFive.jsx | `card.templateId` -> `card.blueprintId`, CardZoomModal |
| CCSignatureRequests.jsx | `req.templateId` -> `req.blueprintId` |
| CCSignatureApprovals.jsx | `req.templateId` -> `req.blueprintId` |
| CCUniqueCards.jsx | Template data references -> blueprint data |
| BinderSharePage.jsx | `card.templateId && card._templateData` -> `card.blueprintId && card._blueprintData` |
| CollectionShowcasePage.jsx | Entry mapping: `template_id` -> `blueprint_id` |
| PackOpening.jsx | Template data references if any |

### Tradematch components (snake_case from API)

| Component | Changes |
|-----------|---------|
| CardPicker.jsx | `card.template_id` -> `card.blueprint_id`, remap to `blueprintId` |
| MatchSplash.jsx | Same pattern |
| Negotiation.jsx | Same pattern |
| Swiper.jsx | Same pattern |
| MatchesAndLikes.jsx | Same pattern |
| TradePileManager.jsx | Same pattern if applicable |

### Bounty components

- Remove `'collection'` from any card type filter lists.

### Vault Dashboard

| Component | Changes |
|-----------|---------|
| CardCreator.jsx | Single "Save" writes to blueprints. No template/draft distinction. |
| TemplatesPage.jsx | Unified blueprint list. No template/draft tabs. |
| CollectionsPage.jsx | Entry browser shows blueprints. No `_type` distinction. No "draft" badge. |
| CollectionShowcase.jsx | `template_id`/`draft_id` -> `blueprint_id`, no `source_type` badge |

### Promo gifts

- CCAdminPromoGift.jsx: Remove `card_type='collection'` branch. Use blueprint picker for any card type.

### Data/config

- `src/data/vault/economy.js`: Remove `'collection'` from card type lists if present.
- `src/config/featureFlags.js`: No changes expected.

## What Does NOT Change

- **`cc_collections`** — Collections as grouping mechanisms are unchanged.
- **Pack slot config** — `cc_pack_types.slots` with `type: 'collection'` and `collectionId` still works. The slot type `'collection'` refers to the pack slot mechanic, not a card type.
- **Card rendering pipeline** — VaultCard -> CanvasCard/StructuredCard hierarchy is untouched.
- **Approval workflow** — Same lifecycle: draft -> pending_review -> approved/rejected/archived.
- **Old tables** — `cc_card_templates` and `cc_card_drafts` remain, just no longer referenced by code.
- **Player cards** — `cc_player_defs` and `def_id` on `cc_cards` are unrelated.
- **God/item/consumable cards** from regular pack slots — generated from game data, no blueprints involved.

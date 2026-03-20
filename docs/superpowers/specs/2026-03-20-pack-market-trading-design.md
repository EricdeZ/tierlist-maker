# Pack Market & Trading Design

## Overview

Extend the existing marketplace and trading systems to support unopened packs as tradeable/sellable items alongside cards. Packs already exist in `cc_pack_inventory` — this feature adds them to the market and trade flows using Approach A (extend existing tables with item_type discrimination).

## Database Changes

### Migration (next available number after existing migrations)

#### `cc_market_listings` pack support

```sql
-- Make card_id nullable (was NOT NULL)
ALTER TABLE cc_market_listings ALTER COLUMN card_id DROP NOT NULL;

-- Add item_type discriminator and pack reference
-- Do NOT use ON DELETE CASCADE — pack opening must check locks first
ALTER TABLE cc_market_listings
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);

-- Exactly one of card_id / pack_inventory_id must be set, matching item_type
ALTER TABLE cc_market_listings ADD CONSTRAINT market_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

-- One active listing per pack (mirrors card unique index)
CREATE UNIQUE INDEX idx_cc_market_pack_active
  ON cc_market_listings (pack_inventory_id)
  WHERE status = 'active';
```

#### `cc_trade_cards` pack support

```sql
-- Make card_id nullable (was NOT NULL)
ALTER TABLE cc_trade_cards ALTER COLUMN card_id DROP NOT NULL;

-- Add item_type discriminator and pack reference
ALTER TABLE cc_trade_cards
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);

-- Exactly one of card_id / pack_inventory_id must be set
ALTER TABLE cc_trade_cards ADD CONSTRAINT trade_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

-- Prevent duplicate packs in same trade
CREATE UNIQUE INDEX idx_cc_trade_packs_unique
  ON cc_trade_cards (trade_id, pack_inventory_id)
  WHERE pack_inventory_id IS NOT NULL;
```

## Backend: Marketplace (`functions/lib/marketplace.js`)

### MARKET_RULES update

```js
max_card_listings_per_user: 15,
max_pack_listings_per_user: 5,
```

### `createListing(sql, userId, { cardId, packInventoryId, price })`

One of `cardId` or `packInventoryId` provided, not both.

**For packs:**
- Validate `cc_pack_inventory.user_id = userId`
- Check pack not in active trade via `isPackInTrade()` helper (see below)
- Check pack not already listed (unique index handles this, but validate for friendly error)
- Enforce 5 active pack listings limit — count query filtered by `item_type = 'pack'`
- Insert with `item_type = 'pack'`, `pack_inventory_id` set, `card_id` null

**For cards (existing, updated):**
- Listing count query must filter by `item_type = 'card'` (was unfiltered total)

### New helper: `isPackInTrade(sql, packInventoryId)`

Shared check used by marketplace listing creation and pack opening:
```sql
SELECT 1 FROM cc_trade_cards tc
JOIN cc_trades t ON tc.trade_id = t.id
WHERE tc.pack_inventory_id = $1 AND t.status IN ('waiting', 'active')
LIMIT 1
```

### `buyListing(tx, buyerId, listingId)` — branch by item_type

**Critical:** The existing query does `JOIN cc_cards c ON l.card_id = c.id` which returns no rows for pack listings. Must restructure:

- Fetch listing row without the card JOIN (just `SELECT * FROM cc_market_listings WHERE id = $1 AND status = 'active' FOR UPDATE`)
- Branch on `listing.item_type`:
  - **card**: Existing logic — fetch card, verify ownership, transfer `cc_cards.owner_id`, remove from Starting Five/binder/signature requests
  - **pack**: Verify pack ownership (`cc_pack_inventory.user_id = seller_id`), transfer via `UPDATE cc_pack_inventory SET user_id = buyerId`. No S5/binder cleanup needed.
- Fee logic identical for both types

### `cancelListing(sql, userId, listingId)`

No changes needed — works for both item types. Pack remains in seller's inventory.

## Backend: Marketplace API (`functions/api/marketplace.js`)

### Query restructuring (critical)

All existing queries in this file hard-JOIN `cc_cards` on `l.card_id`. These must be restructured:

- **`handleList` (browse):** Use LEFT JOIN on `cc_cards` + LEFT JOIN on `cc_pack_types` (via `cc_pack_inventory`). Filter by `itemType` query param. Return `item_type` on each listing.
- **`handleMyListings`:** Same LEFT JOIN restructure.
- **`formatListing`:** Must branch on `item_type` — return card metadata (god_name, rarity, etc.) for cards, pack metadata (pack name, cards_per_pack, category) for packs. Null card fields should not appear in pack listing response.

### GET `action=list`

- Add `itemType` query param: `'card'` | `'pack'` | `'all'` (default `'all'`)
- Pack listings join `cc_pack_inventory` → `cc_pack_types` for: name, description, cards_per_pack, category
- Response includes `item_type` field on each listing

### GET `action=my-listings`

- Return `item_type` on each listing, join pack info for pack listings

### POST `action=create`

- Accept either `cardId` or `packInventoryId` in body (not both, error if both or neither)
- Validate price range 1–10,000 for both cards and packs
- Route to appropriate validation path in `createListing`

## Backend: Trading (`functions/lib/trading.js`)

### TRADE_RULES update

```js
max_cards_per_side: 10,
max_packs_per_side: 5,
```

### Existing `addCard` — update count query

Count query must filter by `item_type = 'card'` (currently counts all rows, which after this change would include packs).

### New: `addPack(tx, userId, tradeId, packInventoryId)`

- Validate pack ownership (`cc_pack_inventory.user_id = userId`)
- Check pack not on marketplace (active listing with this `pack_inventory_id`)
- Check pack not in another active/waiting trade
- Enforce 5 packs per side limit — count filtered by `item_type = 'pack'`
- Insert into `cc_trade_cards` with `item_type = 'pack'`, `pack_inventory_id` set, `card_id` null
- Reset both players' ready/confirmed flags

### New: `removePack(sql, userId, tradeId, packInventoryId)`

- Mirror of `removeCard` — delete from `cc_trade_cards` where `pack_inventory_id` matches
- Reset both players' ready/confirmed flags

### `confirmTrade(tx, userId, tradeId)` — extend (critical)

The existing code loops over all `cc_trade_cards` rows and validates ownership via `cc_cards WHERE id = tc.card_id`. For pack items (`card_id` is NULL), this query returns nothing and throws "card no longer owned". Must restructure:

1. Query all trade items: `SELECT * FROM cc_trade_cards WHERE trade_id = $1`
2. Split into card items (`item_type = 'card'`) and pack items (`item_type = 'pack'`)
3. **Cards:** Existing ownership validation + transfer logic (filter NULL card_ids out of arrays)
4. **Packs:** Validate each pack's `cc_pack_inventory.user_id = offered_by`, then `UPDATE cc_pack_inventory SET user_id = new_owner` for each
5. Empty trade check error message: "add cards, packs, or Core"

### `pollTrade(sql, userId, tradeId)` — extend

The existing query does `JOIN cc_cards c ON tc.card_id = c.id` — pack items would be silently dropped. Must restructure:

- LEFT JOIN `cc_cards` for card items
- LEFT JOIN `cc_pack_inventory` → `cc_pack_types` for pack items
- Return items with `item_type` field so frontend knows what to render

## Backend: Trading API (`functions/api/trading.js`)

- Add `action=add-pack` (POST): `{ tradeId, packInventoryId }`
- Add `action=remove-pack` (POST): `{ tradeId, packInventoryId }`
- `action=poll` response includes pack items with type info
- `action=history` — trade history formatting must handle pack items (LEFT JOIN same as poll)

## Backend: Vault — Pack Lock Checks

### `open-inventory-pack` action in `functions/api/vault.js`

The current code does a blind `DELETE FROM cc_pack_inventory WHERE id = $1 AND user_id = $2 RETURNING pack_type_id`. After the FK additions, this would error if the pack is referenced by a market listing or trade item. Must restructure:

1. SELECT the pack row first (verify ownership)
2. Check not listed on marketplace: `SELECT 1 FROM cc_market_listings WHERE pack_inventory_id = $1 AND status = 'active'`
3. Check not in active trade: use `isPackInTrade()` helper (or inline equivalent)
4. Return friendly error if locked ("Pack is listed on the market" / "Pack is in an active trade")
5. Only then DELETE + open

### Vault load query — pack lock state for frontend

The vault load already fetches `marketLockedCards` and `tradeLockedCards` for card badge display. Add equivalent queries for packs:
- `marketLockedPacks`: pack_inventory_ids with active market listings
- `tradeLockedPacks`: pack_inventory_ids in active/waiting trades

Return these in the vault load response so `CCPackShop` can display indicators.

## Frontend: Marketplace (`CCMarketplace.jsx`)

- Add item type toggle/tabs: Cards | Packs | All
- Pack listings render `PackArt` component (reuse from `CCPackShop`)
- Buy flow works the same — shows pack info instead of card stats
- Create listing flow: add option to list a pack from inventory (picker shows owned packs, excluding locked)

## Frontend: Pack Shop (`CCPackShop.jsx` — MyPacks section)

- Packs listed on market show visual indicator (e.g., "Listed" badge, dimmed appearance)
- Packs in active trade show "In Trade" indicator
- Both states disable tap-to-open
- Uses `marketLockedPacks` / `tradeLockedPacks` from vault load response

## Frontend: Trading (`CCTrading.jsx`)

- Trade offer area shows cards and packs per side
- "Add Pack" button opens picker with owned packs (excluding market-listed and trade-locked)
- Pack items display as `PackArt` with pack name
- Remove pack button works same as remove card

## Pack Ownership Transfer Rules

- `cc_pack_inventory.user_id` updated to new owner
- `source` preserved (original acquisition method)
- Pack retains original `pack_type_id` and `created_at`

## Mutual Exclusion Matrix

| State | List on Market | Add to Trade | Open |
|-------|:-:|:-:|:-:|
| In inventory (free) | Yes | Yes | Yes |
| Listed on market | No | No | No |
| In active trade | No | No | No |

## Limits

| Limit | Value |
|-------|-------|
| Max card market listings per user | 15 |
| Max pack market listings per user | 5 |
| Max cards per trade side | 10 |
| Max packs per trade side | 5 |
| Pack market price range | 1–10,000 Core |
| Market fee | 2% both sides (seller exempt at 1 Core) |

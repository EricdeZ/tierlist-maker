# Pack Market & Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow unopened packs to be listed on the marketplace and included in trades alongside cards.

**Architecture:** Extend existing `cc_market_listings` and `cc_trade_cards` tables with `item_type` discriminator + `pack_inventory_id` FK. Backend lib functions branch on item_type. Frontend reuses `PackArt` component for pack display in market/trade UIs.

**Tech Stack:** PostgreSQL migrations, Cloudflare Pages Functions (JS), React + Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-20-pack-market-trading-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/128-pack-market-trading.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ═══ Pack Market & Trading Support ═══
-- Extend marketplace and trading tables to support packs alongside cards

-- ═══ cc_market_listings: add pack support ═══

ALTER TABLE cc_market_listings ALTER COLUMN card_id DROP NOT NULL;
-- NOTE: The existing idx_cc_market_card_active UNIQUE(card_id) WHERE status='active'
-- allows multiple NULL card_id rows (PostgreSQL NULL uniqueness semantics).
-- This is safe because the CHECK constraint below ensures card_id IS NOT NULL
-- when item_type='card'. Pack uniqueness is enforced by idx_cc_market_pack_active.

ALTER TABLE cc_market_listings
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);
-- NOTE: No ON DELETE CASCADE on pack_inventory_id — intentional.
-- Pack opening must check for active listings before deleting the inventory row.
-- The FK prevents orphaned references if the app-layer check is bypassed.

ALTER TABLE cc_market_listings ADD CONSTRAINT market_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

CREATE UNIQUE INDEX idx_cc_market_pack_active
  ON cc_market_listings (pack_inventory_id)
  WHERE status = 'active';

-- ═══ cc_trade_cards: add pack support ═══

ALTER TABLE cc_trade_cards ALTER COLUMN card_id DROP NOT NULL;
-- NOTE: The existing UNIQUE(trade_id, card_id) allows multiple NULL card_id rows.
-- Safe because CHECK constraint ensures card_id IS NOT NULL when item_type='card'.
-- Pack uniqueness enforced by idx_cc_trade_packs_unique below.

ALTER TABLE cc_trade_cards
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);
-- NOTE: No ON DELETE CASCADE — same reasoning as marketplace.

ALTER TABLE cc_trade_cards ADD CONSTRAINT trade_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

CREATE UNIQUE INDEX idx_cc_trade_packs_unique
  ON cc_trade_cards (trade_id, pack_inventory_id)
  WHERE pack_inventory_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/128-pack-market-trading.sql
git commit -m "feat(vault): add migration for pack market & trading support"
```

---

### Task 2: Marketplace Lib — Pack Support

**Files:**
- Modify: `functions/lib/marketplace.js` (entire file, 148 lines)

- [ ] **Step 1: Update MARKET_RULES**

Replace `max_listings_per_user: 15` with separate limits:

```js
export const MARKET_RULES = {
  fee_percent: 0.02,
  min_fee_core: 1,
  max_card_listings_per_user: 15,
  max_pack_listings_per_user: 5,
}
```

- [ ] **Step 2: Extend `createListing` to accept packs**

Change signature from `{ cardId, price }` to `{ cardId, packInventoryId, price }`.

Add pack validation path. The function should branch at the top:

```js
export async function createListing(sql, userId, { cardId, packInventoryId, price }) {
  if (!price || price < 1) throw new Error('Price must be at least 1 Core')

  if (packInventoryId) {
    return createPackListing(sql, userId, packInventoryId, price)
  }

  // ... existing card listing logic (unchanged, keep as-is) ...
}

async function createPackListing(sql, userId, packInventoryId, price) {
  // Verify pack ownership
  const [pack] = await sql`
    SELECT id, user_id FROM cc_pack_inventory WHERE id = ${packInventoryId}
  `
  if (!pack) throw new Error('Pack not found')
  if (pack.user_id !== userId) throw new Error('You do not own this pack')

  // Check pack not in active trade
  const { isPackInTrade } = await import('./trading.js')
  if (await isPackInTrade(sql, packInventoryId)) {
    throw new Error('Pack is locked in an active trade')
  }

  // Check pack not already listed
  const [existing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${packInventoryId} AND status = 'active'
    LIMIT 1
  `
  if (existing) throw new Error('This pack is already on the market!')

  // Check pack listing limit (separate from card limit)
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_market_listings
    WHERE seller_id = ${userId} AND status = 'active' AND item_type = 'pack'
  `
  if (count >= MARKET_RULES.max_pack_listings_per_user) {
    throw new Error(`Maximum ${MARKET_RULES.max_pack_listings_per_user} active pack listings allowed`)
  }

  const [listing] = await sql`
    INSERT INTO cc_market_listings (seller_id, item_type, pack_inventory_id, price_type, core_price)
    VALUES (${userId}, 'pack', ${packInventoryId}, 'core', ${price})
    RETURNING *
  `
  return listing
}
```

- [ ] **Step 3: Update card listing count check**

In the existing card listing path, update the count query at line 55-58 to filter by `item_type`:

```js
const [{ count }] = await sql`
  SELECT COUNT(*)::int AS count FROM cc_market_listings
  WHERE seller_id = ${userId} AND status = 'active' AND item_type = 'card'
`
if (count >= MARKET_RULES.max_card_listings_per_user) {
  throw new Error(`Maximum ${MARKET_RULES.max_card_listings_per_user} active listings allowed`)
}
```

- [ ] **Step 4: Refactor `buyListing` to branch by item_type**

Replace the existing `buyListing` function (lines 93-147):

```js
export async function buyListing(tx, buyerId, listingId) {
  // Lock listing — no card JOIN, fetch listing independently
  const [listing] = await tx`
    SELECT * FROM cc_market_listings
    WHERE id = ${listingId} AND status = 'active'
    FOR UPDATE
  `
  if (!listing) throw new Error('Listing not found or already sold')
  if (listing.seller_id === buyerId) throw new Error('Cannot buy your own listing')

  const price = listing.core_price
  const fee = calculateFee(price)
  const totalCost = price + fee

  // Verify buyer can afford price + fee
  const [bal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${buyerId}`
  if (!bal || bal.balance < totalCost) throw new Error('Not enough Core')

  // Buyer pays price, seller receives price
  const itemLabel = listing.item_type === 'pack' ? 'pack' : `card #${listing.card_id}`
  await grantEmber(tx, buyerId, 'cc_market_buy', -price, `Marketplace: bought ${itemLabel}`)
  await grantEmber(tx, listing.seller_id, 'cc_market_sell', price, `Marketplace: sold ${itemLabel}`)

  // Buyer always pays fee; seller is exempt at minimum price (1 Core)
  await grantEmber(tx, buyerId, 'cc_market_fee', -fee, 'Marketplace fee (buyer)')
  if (price > 1) {
    await grantEmber(tx, listing.seller_id, 'cc_market_fee', -fee, 'Marketplace fee (seller)')
  }

  if (listing.item_type === 'pack') {
    // Verify pack still owned by seller before transfer
    const [pack] = await tx`SELECT user_id FROM cc_pack_inventory WHERE id = ${listing.pack_inventory_id} FOR UPDATE`
    if (!pack || pack.user_id !== listing.seller_id) throw new Error('Pack is no longer owned by the seller')

    // Transfer pack ownership
    await tx`UPDATE cc_pack_inventory SET user_id = ${buyerId} WHERE id = ${listing.pack_inventory_id}`
  } else {
    // Transfer card ownership
    await tx`UPDATE cc_cards SET owner_id = ${buyerId} WHERE id = ${listing.card_id}`

    // Remove card from Starting 5 lineup
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ${listing.card_id}`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ${listing.card_id}`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ${listing.card_id}`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ${listing.card_id}`

    // Remove card from binder
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ${listing.card_id}`

    // Cancel open signature requests
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ${listing.card_id} AND status IN ('pending', 'awaiting_approval')`
  }

  // Mark listing sold
  const [updated] = await tx`
    UPDATE cc_market_listings
    SET status = 'sold', buyer_id = ${buyerId}, currency_used = 'core', sold_at = NOW()
    WHERE id = ${listingId}
    RETURNING *
  `

  return { listing: updated, price, fee }
}
```

**Note:** `cancelListing` needs no changes — it only updates listing status and doesn't touch card/pack data.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/marketplace.js
git commit -m "feat(vault): extend marketplace lib for pack listings"
```

---

### Task 3: Trading Lib — Pack Support

**Files:**
- Modify: `functions/lib/trading.js` (entire file, 381 lines)

- [ ] **Step 1: Update TRADE_RULES and add `isPackInTrade` helper**

Update rules and add helper after `isCardInTrade` (after line 18):

```js
export const TRADE_RULES = {
  max_cards_per_side: 10,
  max_packs_per_side: 5,
  expiry_minutes: 2,
}

// Check if a pack is locked in an active/waiting trade
export async function isPackInTrade(sql, packInventoryId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${packInventoryId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  return !!row
}
```

- [ ] **Step 2: Update `addCard` count query**

At line 142-148, filter by `item_type = 'card'`:

```js
const [{ count }] = await tx`
  SELECT COUNT(*)::int AS count FROM cc_trade_cards
  WHERE trade_id = ${tradeId} AND offered_by = ${userId} AND item_type = 'card'
`
if (count >= TRADE_RULES.max_cards_per_side) {
  throw new Error(`Maximum ${TRADE_RULES.max_cards_per_side} cards per side`)
}
```

- [ ] **Step 3: Add `addPack` function**

Add after `addCard` (after line 163):

```js
export async function addPack(tx, userId, tradeId, packInventoryId) {
  // Verify trade is active and user is a participant
  const [trade] = await tx`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  // Verify pack ownership
  const [pack] = await tx`
    SELECT id, user_id FROM cc_pack_inventory WHERE id = ${packInventoryId}
  `
  if (!pack) throw new Error('Pack not found')
  if (pack.user_id !== userId) throw new Error('You do not own this pack')

  // Check pack not in another active trade
  const [locked] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${packInventoryId} AND t.status IN ('waiting', 'active') AND t.id != ${tradeId}
    LIMIT 1
  `
  if (locked) throw new Error('Pack is locked in another trade')

  // Check pack not listed on marketplace
  const [listed] = await tx`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${packInventoryId} AND status = 'active'
    LIMIT 1
  `
  if (listed) throw new Error('Pack is listed on the marketplace')

  // Check max packs per side
  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId} AND item_type = 'pack'
  `
  if (count >= TRADE_RULES.max_packs_per_side) {
    throw new Error(`Maximum ${TRADE_RULES.max_packs_per_side} packs per side`)
  }

  await tx`
    INSERT INTO cc_trade_cards (trade_id, pack_inventory_id, offered_by, item_type)
    VALUES (${tradeId}, ${packInventoryId}, ${userId}, 'pack')
  `

  // Reset ready flags
  await tx`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId}
  `
}
```

- [ ] **Step 4: Add `removePack` function**

Add after `removeCard` (after line 180):

```js
export async function removePack(sql, userId, tradeId, packInventoryId) {
  const [removed] = await sql`
    DELETE FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND pack_inventory_id = ${packInventoryId} AND offered_by = ${userId}
    RETURNING id
  `
  if (!removed) throw new Error('Pack not found in your trade offer')

  await sql`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
  `
}
```

- [ ] **Step 5: Refactor `confirmTrade` to handle packs**

In the "BOTH CONFIRMED — EXECUTE SWAP" section (lines 253-311), replace the card-only logic with type-aware logic:

```js
  // ═══ BOTH CONFIRMED — EXECUTE SWAP ═══

  // Get all trade items
  const items = await tx`SELECT * FROM cc_trade_cards WHERE trade_id = ${tradeId}`
  const aItems = items.filter(c => c.offered_by === trade.player_a_id)
  const bItems = items.filter(c => c.offered_by === trade.player_b_id)

  // Must have at least something to trade
  if (aItems.length === 0 && bItems.length === 0 && trade.player_a_core === 0 && trade.player_b_core === 0) {
    throw new Error('Trade is empty — add cards, packs, or Core')
  }

  // Split by type
  const aCards = aItems.filter(i => i.item_type === 'card')
  const bCards = bItems.filter(i => i.item_type === 'card')
  const aPacks = aItems.filter(i => i.item_type === 'pack')
  const bPacks = bItems.filter(i => i.item_type === 'pack')

  // Verify card ownership still valid
  for (const tc of [...aCards, ...bCards]) {
    const [card] = await tx`SELECT owner_id FROM cc_cards WHERE id = ${tc.card_id} FOR UPDATE`
    if (!card || card.owner_id !== tc.offered_by) {
      throw new Error('A card in the trade is no longer owned by the trader')
    }
  }

  // Verify pack ownership still valid (FOR UPDATE to prevent race conditions)
  for (const tp of [...aPacks, ...bPacks]) {
    const [pack] = await tx`SELECT user_id FROM cc_pack_inventory WHERE id = ${tp.pack_inventory_id} FOR UPDATE`
    if (!pack || pack.user_id !== tp.offered_by) {
      throw new Error('A pack in the trade is no longer owned by the trader')
    }
  }
```

Then update the card transfer section to use filtered arrays (replace lines 292-311):

```js
  // Transfer cards: A's cards -> B, B's cards -> A
  if (aCards.length > 0) {
    const aCardIds = aCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_b_id} WHERE id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${aCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }
  if (bCards.length > 0) {
    const bCardIds = bCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_a_id} WHERE id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${bCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }

  // Transfer packs: A's packs -> B, B's packs -> A
  for (const tp of aPacks) {
    await tx`UPDATE cc_pack_inventory SET user_id = ${trade.player_b_id} WHERE id = ${tp.pack_inventory_id}`
  }
  for (const tp of bPacks) {
    await tx`UPDATE cc_pack_inventory SET user_id = ${trade.player_a_id} WHERE id = ${tp.pack_inventory_id}`
  }
```

Update the return value to include pack counts:

```js
  return {
    status: 'completed',
    trade: completed,
    cardsSwapped: { aToB: aCards.length, bToA: bCards.length },
    packsSwapped: { aToB: aPacks.length, bToA: bPacks.length },
    coreSwapped: { aToB: trade.player_a_core, bToA: trade.player_b_core },
  }
```

- [ ] **Step 6: Refactor `pollTrade` to include packs**

Replace the card query at lines 365-377 with a query that handles both types:

```js
  // Get cards in trade (LEFT JOIN for card data)
  const cardItems = await sql`
    SELECT tc.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type,
           c.image_url, c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url,
           d.best_god_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar
    FROM cc_trade_cards tc
    JOIN cc_cards c ON tc.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN users pu ON pu.linked_player_id = d.player_id
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    WHERE tc.trade_id = ${tradeId} AND tc.item_type = 'card'
  `

  // Get packs in trade
  const packItems = await sql`
    SELECT tc.id, tc.pack_inventory_id, tc.offered_by, tc.item_type,
           pi.pack_type_id, pt.name AS pack_name, pt.cards_per_pack, pt.category
    FROM cc_trade_cards tc
    JOIN cc_pack_inventory pi ON tc.pack_inventory_id = pi.id
    JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    WHERE tc.trade_id = ${tradeId} AND tc.item_type = 'pack'
  `

  return { trade, cards: cardItems, packs: packItems }
```

- [ ] **Step 7: Commit**

```bash
git add functions/lib/trading.js
git commit -m "feat(vault): extend trading lib for pack support"
```

---

### Task 4: Marketplace API — Pack Support

**Files:**
- Modify: `functions/api/marketplace.js` (entire file, 265 lines)

- [ ] **Step 1: Update `handleList` query to support packs**

Replace the query at lines 57-73 with LEFT JOINs and add `itemType` filter:

```js
async function handleList(sql, params) {
  const {
    page = '0', limit = '24', sort = 'newest',
    rarity, cardType, search, minPrice, maxPrice, holoType, role,
    itemType,
  } = params

  const offset = parseInt(page) * parseInt(limit)
  const lim = Math.min(parseInt(limit), 50)

  // Build item_type filter
  const typeFilter = itemType === 'card' ? sql`AND l.item_type = 'card'`
    : itemType === 'pack' ? sql`AND l.item_type = 'pack'`
    : sql``

  const rows = await sql`
    SELECT l.id, l.seller_id, l.card_id, l.core_price, l.created_at, l.item_type, l.pack_inventory_id,
           c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url,
           d.best_god_name,
           u.discord_username AS seller_name, u.discord_avatar AS seller_avatar, u.discord_id AS seller_discord_id,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           pt.name AS pack_name, pt.cards_per_pack, pt.category AS pack_category,
           pi.pack_type_id
    FROM cc_market_listings l
    LEFT JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN users pu ON pu.linked_player_id = d.player_id
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_pack_inventory pi ON l.pack_inventory_id = pi.id
    LEFT JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active'
    ${typeFilter}
    ORDER BY l.created_at DESC
  `

  // ... rest of filtering/sorting/pagination stays the same,
  // but card-specific filters (rarity, cardType, holoType, role, search)
  // should only apply to card listings:

  let filtered = Array.from(rows)

  if (rarity) {
    const rarities = rarity.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && rarities.includes(l.rarity))
  }
  if (cardType) {
    const types = cardType.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && types.includes(l.card_type))
  }
  if (holoType) {
    const types = holoType.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && l.holo_type && types.includes(l.holo_type))
  }
  if (role) {
    const roles = role.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && l.role && roles.includes(l.role))
  }
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(l =>
      (l.item_type === 'card' && l.god_name?.toLowerCase().includes(q)) ||
      (l.item_type === 'pack' && l.pack_name?.toLowerCase().includes(q))
    )
  }
  if (minPrice) {
    filtered = filtered.filter(l => l.core_price >= parseInt(minPrice))
  }
  if (maxPrice) {
    filtered = filtered.filter(l => l.core_price <= parseInt(maxPrice))
  }

  // Sorting — update rarity sorts to handle packs (null rarity sorts to end)
  const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
  const packSortEnd = 99 // packs have no rarity, sort to end
  switch (sort) {
    case 'price_asc': filtered.sort((a, b) => a.core_price - b.core_price); break
    case 'price_desc': filtered.sort((a, b) => b.core_price - a.core_price); break
    case 'rarity_asc': filtered.sort((a, b) => (rarityOrder[a.rarity] ?? packSortEnd) - (rarityOrder[b.rarity] ?? packSortEnd)); break
    case 'rarity_desc': filtered.sort((a, b) => (rarityOrder[b.rarity] ?? packSortEnd) - (rarityOrder[a.rarity] ?? packSortEnd)); break
    case 'oldest': filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break
    default: break
  }

  // ... pagination unchanged ...
```

- [ ] **Step 2: Update `handleMyListings` query**

Replace the query at lines 130-147 with LEFT JOINs:

```js
async function handleMyListings(sql, user) {
  const rows = await sql`
    SELECT l.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url,
           d.best_god_name,
           bu.discord_username AS buyer_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           pt.name AS pack_name, pt.cards_per_pack, pt.category AS pack_category,
           pi.pack_type_id
    FROM cc_market_listings l
    LEFT JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN users pu ON pu.linked_player_id = d.player_id
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_pack_inventory pi ON l.pack_inventory_id = pi.id
    LEFT JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    LEFT JOIN users bu ON l.buyer_id = bu.id
    WHERE l.seller_id = ${user.id}
    ORDER BY
      CASE l.status WHEN 'active' THEN 0 WHEN 'sold' THEN 1 ELSE 2 END,
      l.created_at DESC
  `

  const listings = Array.from(rows)
  const activeCards = listings.filter(l => l.status === 'active' && l.item_type === 'card').length
  const activePacks = listings.filter(l => l.status === 'active' && l.item_type === 'pack').length

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      listings: listings.map(l => ({
        ...formatListing(l),
        status: l.status,
        buyerName: l.buyer_name || null,
        soldAt: l.sold_at,
      })),
      activeCardCount: activeCards,
      activePackCount: activePacks,
      maxCardListings: MARKET_RULES.max_card_listings_per_user,
      maxPackListings: MARKET_RULES.max_pack_listings_per_user,
    }),
  }
}
```

**Breaking change:** The response replaces `activeCount` with `activeCardCount`/`activePackCount` and `maxListings` with `maxCardListings`/`maxPackListings`. The frontend (Task 8 Step 4) must update to use these new field names. Also remove the hardcoded `const MAX_LISTINGS = 15` in `CCMarketplace.jsx` (line 33) — use the API response values instead.

- [ ] **Step 3: Update `handleCreate` to accept packs**

Replace lines 167-183:

```js
async function handleCreate(sql, user, body) {
  const { cardId, packInventoryId, price } = body
  if (!cardId && !packInventoryId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId or packInventoryId required' }) }
  }
  if (cardId && packInventoryId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide cardId or packInventoryId, not both' }) }
  }
  const parsedPrice = parseInt(price)
  if (!parsedPrice || parsedPrice < 1 || parsedPrice > 10000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Price must be between 1 and 10,000' }) }
  }

  const listing = await createListing(sql, user.id, { cardId, packInventoryId, price: parsedPrice })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ listing: { id: listing.id, status: listing.status } }),
  }
}
```

- [ ] **Step 4: Update `formatListing` to branch by item_type**

Replace lines 230-263:

```js
function formatListing(row) {
  const base = {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || null,
    sellerAvatar: row.seller_discord_id && row.seller_avatar
      ? `https://cdn.discordapp.com/avatars/${row.seller_discord_id}/${row.seller_avatar}.webp?size=64`
      : null,
    price: row.core_price,
    createdAt: row.created_at,
    itemType: row.item_type,
  }

  if (row.item_type === 'pack') {
    return {
      ...base,
      packInventoryId: row.pack_inventory_id,
      pack: {
        packTypeId: row.pack_type_id,
        name: row.pack_name,
        cardsPerPack: row.cards_per_pack,
        category: row.pack_category,
      },
    }
  }

  return {
    ...base,
    cardId: row.card_id,
    card: {
      godId: row.god_id,
      godName: row.god_name,
      godClass: row.god_class,
      role: row.role,
      rarity: row.rarity,
      holoEffect: row.holo_effect,
      holoType: row.holo_type,
      imageUrl: row.card_type === 'player'
        ? (row.allow_discord_avatar && row.player_discord_id && row.player_discord_avatar
          ? `https://cdn.discordapp.com/avatars/${row.player_discord_id}/${row.player_discord_avatar}.webp?size=256`
          : '')
        : row.image_url,
      cardType: row.card_type,
      cardData: row.card_data,
      serialNumber: row.serial_number,
      defId: row.def_id,
      isConnected: row.card_data?.isConnected ?? null,
      bestGodName: row.best_god_name || null,
      signatureUrl: row.signature_url || null,
    },
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/marketplace.js
git commit -m "feat(vault): update marketplace API for pack listings"
```

---

### Task 5: Trading API — Pack Support

**Files:**
- Modify: `functions/api/trading.js` (entire file, 284 lines)

- [ ] **Step 1: Update imports**

Add `addPack` and `removePack` to the import at lines 5-9:

```js
import {
  createTrade, joinTrade, cancelTrade,
  addCard, removeCard, addPack, removePack,
  setCore, setReady,
  confirmTrade, pollTrade, expireStale,
} from '../lib/trading.js'
```

- [ ] **Step 2: Add `add-pack` and `remove-pack` actions to POST switch**

Add to the switch at lines 38-48:

```js
case 'add-pack': return await handleAddPack(user, body)
case 'remove-pack': return await handleRemovePack(sql, user, body)
```

- [ ] **Step 3: Add handler functions**

Add after `handleRemoveCard` (after line 160):

```js
// ═══ POST: Add pack to trade ═══
async function handleAddPack(user, body) {
  const { tradeId, packInventoryId } = body
  if (!tradeId || !packInventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and packInventoryId required' }) }

  await transaction(async (tx) => {
    await addPack(tx, user.id, parseInt(tradeId), parseInt(packInventoryId))
  })
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Remove pack from trade ═══
async function handleRemovePack(sql, user, body) {
  const { tradeId, packInventoryId } = body
  if (!tradeId || !packInventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and packInventoryId required' }) }

  await removePack(sql, user.id, parseInt(tradeId), parseInt(packInventoryId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}
```

- [ ] **Step 4: Update `handlePoll` to return packs**

Update the poll handler at lines 59-69 to include packs from the response:

```js
async function handlePoll(sql, user, params) {
  const { tradeId } = params
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const { trade, cards, packs } = await pollTrade(sql, user.id, parseInt(tradeId))

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      trade: formatTrade(trade, user.id),
      cards: cards.map(formatTradeCard),
      packs: packs.map(formatTradePack),
    }),
  }
}
```

- [ ] **Step 5: Add `formatTradePack` formatter**

Add after `formatTradeCard` (after line 276):

```js
function formatTradePack(row) {
  return {
    id: row.id,
    packInventoryId: row.pack_inventory_id,
    offeredBy: row.offered_by,
    itemType: 'pack',
    pack: {
      packTypeId: row.pack_type_id,
      name: row.pack_name,
      cardsPerPack: row.cards_per_pack,
      category: row.category,
    },
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/trading.js
git commit -m "feat(vault): update trading API for pack support"
```

---

### Task 6: Vault API — Pack Lock Checks

**Files:**
- Modify: `functions/api/vault.js`

- [ ] **Step 1: Add pack lock checks to `handleOpenInventoryPack`**

Replace the blind DELETE at lines 312-318 with SELECT + lock validation + DELETE:

```js
async function handleOpenInventoryPack(sql, user, body) {
  const { inventoryId } = body
  if (!inventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'inventoryId required' }) }

  // Verify ownership
  const [pack] = await sql`
    SELECT id, pack_type_id, user_id FROM cc_pack_inventory
    WHERE id = ${inventoryId} AND user_id = ${user.id}
  `
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack not found in inventory' }) }

  // Check not listed on marketplace
  const [marketLock] = await sql`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${inventoryId} AND status = 'active'
    LIMIT 1
  `
  if (marketLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack is listed on the market — cancel the listing first' }) }

  // Check not in active trade
  const [tradeLock] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${inventoryId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  if (tradeLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack is in an active trade — cancel the trade first' }) }

  // Delete from inventory and open
  await sql`DELETE FROM cc_pack_inventory WHERE id = ${inventoryId}`

  const result = await openPack(sql, user.id, pack.pack_type_id, { skipPayment: true })
  // ... rest of the handler stays the same (card formatting, challenge push, return) ...
```

- [ ] **Step 2: Add pack lock queries to vault load**

Near the existing `marketLockedCards` and `tradeLockedCards` queries (around line 216), add parallel queries for packs:

```js
sql`SELECT pack_inventory_id FROM cc_market_listings WHERE seller_id = ${user.id} AND status = 'active' AND item_type = 'pack'`,
sql`
  SELECT tc.pack_inventory_id FROM cc_trade_cards tc
  JOIN cc_trades t ON tc.trade_id = t.id
  WHERE tc.offered_by = ${user.id} AND t.status IN ('waiting', 'active') AND tc.item_type = 'pack'
`,
```

Add the results to the response alongside existing `lockedCardIds`:

```js
lockedPackIds: [
  ...marketLockedPacks.map(r => r.pack_inventory_id),
  ...tradeLockedPacks.map(r => r.pack_inventory_id),
],
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add pack lock checks for opening, market, and trade"
```

---

### Task 7: Frontend Service Layer

**Files:**
- Modify: `src/services/database.js`

- [ ] **Step 1: Add pack methods to marketplaceService**

The existing `create` method already passes a data object, so it supports `{ packInventoryId, price }` without changes. The `list` method already passes params, so `itemType` is supported automatically.

No changes needed to `marketplaceService`.

- [ ] **Step 2: Add pack methods to tradingService**

Add after `removeCard` at line 1241:

```js
async addPack(tradeId, packInventoryId) {
    return apiPost('trading', { action: 'add-pack' }, { tradeId, packInventoryId })
},
async removePack(tradeId, packInventoryId) {
    return apiPost('trading', { action: 'remove-pack' }, { tradeId, packInventoryId })
},
```

- [ ] **Step 3: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add trading pack service methods"
```

---

### Task 8: Vault Context — Wire `lockedPackIds`

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`

- [ ] **Step 1: Store and expose `lockedPackIds`**

From the vault load response, extract `lockedPackIds` and expose it through the context:

```js
const [lockedPackIds, setLockedPackIds] = useState([])

// In the load function, after receiving vault data:
setLockedPackIds(data.lockedPackIds || [])
```

Add `lockedPackIds` to the context value.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(vault): expose lockedPackIds in vault context"
```

---

### Task 9: Frontend — Marketplace Pack Support

**Files:**
- Modify: `src/pages/vault/CCMarketplace.jsx`

- [ ] **Step 1: Add item type filter state and toggle UI**

Add state near other filter state:

```js
const [itemTypeFilter, setItemTypeFilter] = useState('all') // 'all' | 'card' | 'pack'
```

Add toggle tabs at the top of the filter area (before existing rarity/type filters):

```jsx
<div className="flex gap-1 mb-3">
  {['all', 'card', 'pack'].map(type => (
    <button key={type} onClick={() => setItemTypeFilter(type)}
      className={`px-3 py-1 text-xs rounded ${itemTypeFilter === type ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'}`}>
      {type === 'all' ? 'All' : type === 'card' ? 'Cards' : 'Packs'}
    </button>
  ))}
</div>
```

Pass `itemType` to the list API call in the fetch function:

```js
const data = await marketplaceService.list({ ...params, itemType: itemTypeFilter === 'all' ? undefined : itemTypeFilter })
```

- [ ] **Step 2: Update listing card rendering to branch by itemType**

In the listings grid, branch on `listing.itemType`:

```jsx
{listing.itemType === 'pack' ? (
  <PackArt
    tier={listing.pack.category}
    name={listing.pack.name}
    cardCount={listing.pack.cardsPerPack}
  />
) : (
  // existing card rendering
)}
```

Import `PackArt` from the pack shop components.

- [ ] **Step 3: Update create listing flow to support packs**

In the "create listing" modal/flow, add a toggle to switch between listing a card and listing a pack. When "pack" is selected, show the user's inventory packs (from vault context) filtered by `lockedPackIds`. Use `{ packInventoryId, price }` instead of `{ cardId, price }` in the create call.

- [ ] **Step 4: Update my-listings display**

Handle `activeCardCount`/`activePackCount` and `maxCardListings`/`maxPackListings` from the updated response. Show separate counts in the UI header.

Format pack listings in the my-listings list using `PackArt` instead of card display.

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/CCMarketplace.jsx
git commit -m "feat(vault): marketplace UI for pack listings"
```

---

### Task 10: Frontend — Pack Shop Lock Indicators

**Files:**
- Modify: `src/pages/vault/CCPackShop.jsx`

- [ ] **Step 1: Consume `lockedPackIds` from vault context**

In the `MyPacks` component, get `lockedPackIds` from the vault context (or wherever the vault load response is stored):

```js
const { inventory, openInventoryPack, giftData, openGift, packTypesMap, lockedPackIds } = useVault()
const lockedSet = useMemo(() => new Set(lockedPackIds || []), [lockedPackIds])
```

- [ ] **Step 2: Add lock indicator and disable opening**

In the inventory pack grid, check if each pack is locked:

```jsx
{inventory.map((item, i) => {
  const pack = packTypesMap[item.packTypeId]
  if (!pack) return null
  const isLocked = lockedSet.has(item.id)
  const isOpening = loading === `inv-${item.id}`
  return (
    <button key={item.id}
      onClick={() => !isLocked && handleOpenInventory(item)}
      disabled={isLocked || isOpening}
      className={`... ${isLocked ? 'opacity-50' : ''}`}>
      <PackArt ... />
      {isLocked ? (
        <span className="text-[9px] text-amber-400/80 uppercase tracking-wider">Listed / In Trade</span>
      ) : (
        <span className="...">TAP TO OPEN</span>
      )}
    </button>
  )
})}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/CCPackShop.jsx
git commit -m "feat(vault): show lock indicators on listed/traded packs"
```

---

### Task 11: Frontend — Trading Pack Support

**Files:**
- Modify: `src/pages/vault/CCTrading.jsx`

- [ ] **Step 1: Handle packs in poll response**

Update the poll data handling to store both `cards` and `packs` from the response:

```js
const { trade, cards, packs } = data
// Store packs alongside cards in state
```

- [ ] **Step 2: Display packs in trade offer area**

In the `TradeRoom` component, render packs below cards for each side. Use `PackArt` for display:

```jsx
{myPacks.map(p => (
  <div key={p.id} className="relative">
    <PackArt tier={p.pack.category} name={p.pack.name} cardCount={p.pack.cardsPerPack} />
    <button onClick={() => handleRemovePack(p.packInventoryId)} className="...">X</button>
  </div>
))}
```

- [ ] **Step 3: Add "Add Pack" button and picker**

Add an "Add Pack" button alongside the existing "Add Card" button. On click, show a picker modal with the user's inventory packs, filtered to exclude those in `lockedPackIds` and already in the current trade:

```jsx
const availablePacks = useMemo(() => {
  const lockedSet = new Set(lockedPackIds || [])
  const inTradeSet = new Set(myPacks.map(p => p.packInventoryId))
  return inventory.filter(p => !lockedSet.has(p.id) && !inTradeSet.has(p.id))
}, [inventory, lockedPackIds, myPacks])
```

On selection, call `tradingService.addPack(tradeId, packInventoryId)`.

- [ ] **Step 4: Add remove pack handler**

```js
const handleRemovePack = async (packInventoryId) => {
  await tradingService.removePack(tradeId, packInventoryId)
  // Re-poll to refresh state
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/CCTrading.jsx
git commit -m "feat(vault): trading UI for pack offers"
```

---

### Task 12: Manual Integration Test

- [ ] **Step 1: Run the migration against local dev database**

```bash
# Apply migration
psql $DATABASE_URL -f database/migrations/128-pack-market-trading.sql
```

- [ ] **Step 2: Start dev server and test marketplace pack flow**

```bash
npm start
```

Test:
1. Open pack shop, verify packs in inventory show correctly
2. Go to marketplace, create a listing for a pack from inventory
3. Verify pack shows "Listed" indicator in pack shop
4. Verify pack listing appears in marketplace browse (All and Packs filter)
5. Verify pack listing appears in my-listings
6. Cancel the pack listing, verify pack is free again
7. Buy a pack listing from another user (or test account)

- [ ] **Step 3: Test trading pack flow**

1. Create a trade with another user
2. Add a pack to the trade offer
3. Verify pack shows in trade room
4. Verify pack can't be listed on market while in trade
5. Remove pack from trade
6. Complete a trade that includes packs
7. Verify pack ownership transferred

- [ ] **Step 4: Test lock enforcement**

1. List a pack on market, try to open it — should error
2. Add pack to trade, try to open it — should error
3. Add pack to trade, try to list it — should error
4. List pack on market, try to add to trade — should error

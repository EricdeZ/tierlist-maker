# Tradematch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tinder-style card trading matchmaker that lets users mark cards for trade, swipe through others' trade piles, get matched on mutual interest, and negotiate async trades.

**Architecture:** New `/api/tradematch` endpoint handles discovery (trade pile, swiping, feed, likes). Matches create `mode='match'` trades in the existing `cc_trades` table, reusing the trade room for async negotiation. Existing lock-check queries are updated to be mode-aware so match-trades don't lock cards.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-21-tradematch-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `database/migrations/132-tradematch.sql` | New tables + cc_trades alterations |
| `functions/lib/tradematch.js` | Business logic: trade pile, swipe feed, match detection, likes |
| `functions/api/tradematch.js` | API endpoint routing for all tradematch actions |
| `src/pages/vault/tradematch/TradePileManager.jsx` | Trade pile grid with mark/unmark UI |
| `src/pages/vault/tradematch/Swiper.jsx` | Premium Tinder-style card swipe UI |
| `src/pages/vault/tradematch/MatchSplash.jsx` | "It's a Match!" fullscreen animation |
| `src/pages/vault/tradematch/MatchesAndLikes.jsx` | Active matches list + likes list |
| `src/pages/vault/CCTradematch.jsx` | Top-level Tradematch tab orchestrator |

### Modified Files
| File | Changes |
|------|---------|
| `functions/lib/trading.js` | Mode-aware: `isCardInTrade`, `isPackInTrade`, `expireStale`, `createTrade`, `addCard`, `addPack` |
| `functions/api/trading.js` | Mode filter on `handlePending`, `handleHistory` |
| `functions/api/vault.js` | Mode-aware expiry, trade count, locked cards/packs, binder slot |
| `functions/lib/starting-five.js` | Mode filter on consumable trade-lock query |
| `functions/lib/bounty.js` | Mode filter on fulfillBounty trade-lock query |
| `functions/lib/marketplace.js` | Mode filter on createListing trade-lock query |
| `src/services/database.js` | Add tradematchService inline (same pattern as other services) |
| `src/pages/vault/VaultTabBar.jsx` | Add Tradematch tab |
| `src/pages/vault/VaultContext.jsx` | Add tradematch state (trade pile count, match count) |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/132-tradematch.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Tradematch: Tinder-style card trading matchmaker

-- Trade pile: cards marked for trade
CREATE TABLE cc_trade_pile (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);
CREATE INDEX idx_cc_trade_pile_user ON cc_trade_pile(user_id);
CREATE INDEX idx_cc_trade_pile_card ON cc_trade_pile(card_id);

-- Swipes: right-swipe records only
CREATE TABLE cc_swipes (
    id SERIAL PRIMARY KEY,
    swiper_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER NOT NULL REFERENCES cc_cards(id) ON DELETE CASCADE,
    card_owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(swiper_id, card_id)
);
CREATE INDEX idx_cc_swipes_owner ON cc_swipes(card_owner_id);
CREATE INDEX idx_cc_swipes_swiper ON cc_swipes(swiper_id);

-- Add mode column to cc_trades
ALTER TABLE cc_trades ADD COLUMN mode TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE cc_trades ADD COLUMN match_swipe_a_id INTEGER REFERENCES cc_swipes(id);
ALTER TABLE cc_trades ADD COLUMN match_swipe_b_id INTEGER REFERENCES cc_swipes(id);

-- Recreate unique indexes with mode filter (direct trades only)
DROP INDEX idx_cc_trades_player_a_active;
DROP INDEX idx_cc_trades_player_b_active;
CREATE UNIQUE INDEX idx_cc_trades_player_a_active
    ON cc_trades(player_a_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';
CREATE UNIQUE INDEX idx_cc_trades_player_b_active
    ON cc_trades(player_b_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';

-- Prevent duplicate active matches between the same pair
CREATE UNIQUE INDEX idx_cc_trades_match_pair_active
    ON cc_trades (LEAST(player_a_id, player_b_id), GREATEST(player_a_id, player_b_id))
    WHERE mode = 'match' AND status = 'active';

-- Index for outgoing match count
CREATE INDEX idx_cc_trades_match_outgoing
    ON cc_trades(player_a_id) WHERE mode = 'match' AND status = 'active';
```

- [ ] **Step 2: Run migration against dev database**

Run: `psql $DATABASE_URL -f database/migrations/132-tradematch.sql`
Expected: Tables created, indexes rebuilt, no errors.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/132-tradematch.sql
git commit -m "feat(vault): add tradematch migration — trade pile, swipes, mode column"
```

---

### Task 2: Mode-Aware Fixes to Existing Backend

**Files:**
- Modify: `functions/lib/trading.js:11-41` (isCardInTrade, isPackInTrade, expireStale)
- Modify: `functions/lib/trading.js:43-54` (createTrade)
- Modify: `functions/lib/trading.js:116-122` (addCard inline lock)
- Modify: `functions/lib/trading.js:195-200` (addPack inline lock)
- Modify: `functions/api/trading.js:82-89` (handlePending)
- Modify: `functions/api/trading.js:99-111` (handleHistory)
- Modify: `functions/api/vault.js:201-238` (trade count, expiry, locked cards/packs)
- Modify: `functions/api/vault.js:2390-2394` (handleBinderSlot)
- Modify: `functions/lib/starting-five.js:521-525` (slotConsumable lock)
- Modify: `functions/lib/bounty.js:95-99` (fulfillBounty lock)
- Modify: `functions/lib/marketplace.js:31-37` (createListing lock)

- [ ] **Step 1: Update `isCardInTrade` in `functions/lib/trading.js:11-19`**

Add `AND t.mode = 'direct'` to the WHERE clause:

```js
export async function isCardInTrade(sql, cardId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  return !!row
}
```

- [ ] **Step 2: Update `isPackInTrade` in `functions/lib/trading.js:22-30`**

Same pattern — add `AND t.mode = 'direct'`:

```js
export async function isPackInTrade(sql, packInventoryId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${packInventoryId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  return !!row
}
```

- [ ] **Step 3: Update `expireStale` in `functions/lib/trading.js:33-41`**

Handle both modes: direct (2 min from last_polled_at) and match (24h from created_at):

```js
export async function expireStale(sql) {
  const mins = TRADE_RULES.expiry_minutes
  await sql`
    UPDATE cc_trades
    SET status = 'expired', updated_at = NOW()
    WHERE (status IN ('waiting', 'active') AND mode = 'direct'
           AND last_polled_at < NOW() - make_interval(mins => ${mins}))
       OR (status = 'active' AND mode = 'match'
           AND created_at < NOW() - interval '24 hours')
  `
}
```

- [ ] **Step 4: Update `createTrade` in `functions/lib/trading.js:47-53`**

Add `AND mode = 'direct'` to the active-trade check:

```js
  const [existing] = await sql`
    SELECT id FROM cc_trades
    WHERE status IN ('waiting', 'active') AND mode = 'direct'
      AND (player_a_id = ${userId} OR player_b_id = ${userId}
           OR player_a_id = ${targetUserId} OR player_b_id = ${targetUserId})
    LIMIT 1
  `
```

- [ ] **Step 5: Update `addCard` inline lock in `functions/lib/trading.js:116-122`**

Add `AND t.mode = 'direct'` so cards in match-trades aren't blocked:

```js
  const [locked] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.id != ${tradeId} AND t.mode = 'direct'
    LIMIT 1
  `
```

- [ ] **Step 6: Update `addPack` inline lock in `functions/lib/trading.js:195-200`**

Same pattern for packs. Find the inline query in `addPack` and add `AND t.mode = 'direct'`.

- [ ] **Step 7: Update `handlePending` in `functions/api/trading.js:82-89`**

Add mode filter so match-trades don't show in the direct trade inbox:

```sql
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('waiting', 'active')
      AND t.mode = 'direct'
```

- [ ] **Step 8: Update `handleHistory` in `functions/api/trading.js:99-106`**

Add `mode` to the SELECT and filter to `mode = 'direct'` (match-trade history is in the tradematch endpoint):

```sql
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('completed', 'cancelled', 'expired')
      AND t.mode = 'direct'
```

- [ ] **Step 9: Update vault.js trade count query (~line 201-205)**

Filter to direct trades only:

```sql
    SELECT COUNT(*)::int AS count FROM cc_trades
    WHERE ((player_b_id = ${user.id} AND status = 'waiting')
       OR ((player_a_id = ${user.id} OR player_b_id = ${user.id}) AND status = 'active'))
      AND mode = 'direct'
```

- [ ] **Step 10: Update vault.js inline expiry (~line 213-217)**

Same dual-mode expiry as `expireStale`:

```sql
    UPDATE cc_trades SET status = 'expired', updated_at = NOW()
    WHERE (status IN ('waiting', 'active') AND mode = 'direct'
           AND last_polled_at < NOW() - make_interval(mins => 2))
       OR (status = 'active' AND mode = 'match'
           AND created_at < NOW() - interval '24 hours')
```

- [ ] **Step 11: Update vault.js locked cards query (~line 224-230)**

Add `AND t.mode = 'direct'` to the trade union branch:

```sql
    SELECT tc.card_id, 'trade' FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.offered_by = ${user.id} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' AND tc.card_id IS NOT NULL
```

- [ ] **Step 12: Update vault.js locked packs query (~line 232-238)**

Same — add `AND t.mode = 'direct'`:

```sql
    SELECT tc.pack_inventory_id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.offered_by = ${user.id} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' AND tc.item_type = 'pack'
```

- [ ] **Step 13: Update vault.js `handleBinderSlot` trade-lock (~line 2390-2394)**

Find the inline trade-lock query in `handleBinderSlot` and add `AND t.mode = 'direct'`.

- [ ] **Step 14: Update `functions/lib/starting-five.js` (~line 521-525)**

Find the `slotConsumable` trade-lock query and add `AND t.mode = 'direct'`.

- [ ] **Step 15: Update `functions/lib/bounty.js` (~line 95-99)**

Find the `fulfillBounty` trade-lock query and add `AND t.mode = 'direct'`.

- [ ] **Step 16: Update `functions/lib/marketplace.js` (~line 31-37)**

Find the `createListing` card trade-lock query and add `AND t.mode = 'direct'`.

- [ ] **Step 17: Verify existing trading still works**

Run: `npm run dev`

Manual smoke test: create a direct trade, add a card, confirm — verify it still works with the new `mode` column defaulting to `'direct'`.

- [ ] **Step 18: Commit**

```bash
git add functions/lib/trading.js functions/api/trading.js functions/api/vault.js functions/lib/starting-five.js functions/lib/bounty.js functions/lib/marketplace.js
git commit -m "fix(vault): make all trade-lock queries mode-aware for tradematch compatibility"
```

---

### Task 3: Tradematch Backend Library

**Files:**
- Create: `functions/lib/tradematch.js`

**Depends on:** Task 1 (migration), Task 2 (mode-aware fixes)

- [ ] **Step 1: Create `functions/lib/tradematch.js` with trade pile functions**

```js
// Tradematch — Tinder-style card trading matchmaker
// Discovery layer: trade pile, swipe feed, match detection, likes

export const TRADEMATCH_RULES = {
  min_trade_pile: 20,
  max_outgoing_matches: 5,
  match_expiry_hours: 24,
  feed_page_size: 50,
}

// ══════════════════════════════════════════════
// Trade Pile
// ══════════════════════════════════════════════

export async function getTradePile(sql, userId) {
  return sql`
    SELECT tp.id, tp.card_id, tp.created_at,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id
    FROM cc_trade_pile tp
    JOIN cc_cards c ON tp.card_id = c.id
    WHERE tp.user_id = ${userId}
    ORDER BY tp.created_at DESC
  `
}

export async function addToTradePile(sql, userId, cardId) {
  // Verify ownership
  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check not in Starting 5
  const [inLineup] = await sql`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${userId}
    LIMIT 1
  `
  if (inLineup) throw new Error('Card is in your Starting 5 lineup')

  // Check not slotted as S5 consumable
  const [inS5] = await sql`SELECT user_id FROM cc_starting_five_state WHERE consumable_card_id = ${cardId}`
  if (inS5) throw new Error('Card is slotted in Starting 5')

  // Check not in binder
  const [inBinder] = await sql`SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1`
  if (inBinder) throw new Error('Card is in your binder')

  // Check not on marketplace
  const [onMarket] = await sql`SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active' LIMIT 1`
  if (onMarket) throw new Error('Card is listed on the marketplace')

  // Check not in active direct trade
  const [inTrade] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  if (inTrade) throw new Error('Card is locked in a direct trade')

  await sql`INSERT INTO cc_trade_pile (user_id, card_id) VALUES (${userId}, ${cardId}) ON CONFLICT DO NOTHING`
}

export async function removeFromTradePile(sql, userId, cardId) {
  await sql`DELETE FROM cc_trade_pile WHERE user_id = ${userId} AND card_id = ${cardId}`
}

export async function getTradePileCount(sql, userId) {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM cc_trade_pile WHERE user_id = ${userId}`
  return count
}
```

- [ ] **Step 2: Add swipe feed function**

Append to `functions/lib/tradematch.js`:

```js
// ══════════════════════════════════════════════
// Swipe Feed
// ══════════════════════════════════════════════

export async function getSwipeFeed(sql, userId, offset = 0) {
  const limit = TRADEMATCH_RULES.feed_page_size

  return sql`
    WITH my_pile AS (
      SELECT card_id FROM cc_trade_pile WHERE user_id = ${userId}
    ),
    my_gods AS (
      SELECT DISTINCT god_id, rarity FROM cc_cards WHERE owner_id = ${userId}
    ),
    active_match_partners AS (
      SELECT CASE WHEN player_a_id = ${userId} THEN player_b_id ELSE player_a_id END AS partner_id
      FROM cc_trades
      WHERE mode = 'match' AND status = 'active'
        AND (player_a_id = ${userId} OR player_b_id = ${userId})
    ),
    boost_users AS (
      SELECT DISTINCT s.swiper_id AS user_id
      FROM cc_swipes s
      JOIN my_pile mp ON s.card_id = mp.card_id
      WHERE s.card_owner_id = ${userId}
    )
    SELECT tp.card_id, tp.user_id AS owner_id,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id,
           u.discord_username AS owner_name, u.discord_avatar AS owner_avatar, u.discord_id AS owner_discord_id,
           CASE WHEN bu.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_boost,
           CASE WHEN mg.god_id IS NULL THEN 1 ELSE 0 END AS is_novel
    FROM cc_trade_pile tp
    JOIN cc_cards c ON tp.card_id = c.id
    JOIN users u ON tp.user_id = u.id
    LEFT JOIN cc_swipes sw ON sw.swiper_id = ${userId} AND sw.card_id = tp.card_id
    LEFT JOIN active_match_partners amp ON tp.user_id = amp.partner_id
    LEFT JOIN boost_users bu ON tp.user_id = bu.user_id
    LEFT JOIN my_gods mg ON c.god_id = mg.god_id AND c.rarity = mg.rarity
    WHERE tp.user_id != ${userId}
      AND sw.id IS NULL
      AND amp.partner_id IS NULL
    ORDER BY has_boost DESC, is_novel DESC, tp.created_at DESC, random()
    LIMIT ${limit} OFFSET ${offset}
  `
}
```

- [ ] **Step 3: Add swipe + match detection function**

Append to `functions/lib/tradematch.js`:

```js
// ══════════════════════════════════════════════
// Swipe + Match Detection
// ══════════════════════════════════════════════

export async function recordSwipe(sql, swiperId, cardId) {
  // Verify card exists and is in someone's trade pile
  const [tpEntry] = await sql`
    SELECT tp.user_id AS card_owner_id
    FROM cc_trade_pile tp
    WHERE tp.card_id = ${cardId} AND tp.user_id != ${swiperId}
  `
  if (!tpEntry) throw new Error('Card not available')

  const cardOwnerId = tpEntry.card_owner_id

  // Check outgoing match cap
  const [{ count: outgoing }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trades
    WHERE player_a_id = ${swiperId} AND mode = 'match' AND status = 'active'
  `
  if (outgoing >= TRADEMATCH_RULES.max_outgoing_matches) {
    throw new Error('Too many active matches — handle existing matches first')
  }

  // Record swipe (ignore duplicate via ON CONFLICT)
  await sql`
    INSERT INTO cc_swipes (swiper_id, card_id, card_owner_id)
    VALUES (${swiperId}, ${cardId}, ${cardOwnerId})
    ON CONFLICT (swiper_id, card_id) DO NOTHING
  `

  // Check for match: does card owner have a swipe on any of swiper's trade pile cards?
  const [matchSwipe] = await sql`
    SELECT s.id AS swipe_id, s.card_id
    FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${swiperId}
    WHERE s.swiper_id = ${cardOwnerId}
    LIMIT 1
  `

  if (!matchSwipe) return { matched: false }

  // Get swiper's swipe ID
  const [mySwipe] = await sql`
    SELECT id FROM cc_swipes WHERE swiper_id = ${swiperId} AND card_id = ${cardId}
  `

  // Create match trade
  let trade
  try {
    ;[trade] = await sql`
      INSERT INTO cc_trades (player_a_id, player_b_id, mode, status, match_swipe_a_id, match_swipe_b_id)
      VALUES (${swiperId}, ${cardOwnerId}, 'match', 'active', ${mySwipe.id}, ${matchSwipe.swipe_id})
      RETURNING *
    `
  } catch (e) {
    // Duplicate match pair — already matched with this user
    if (e.code === '23505') return { matched: false }
    throw e
  }

  // Pre-load both matched cards
  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${trade.id}, ${cardId}, ${cardOwnerId}),
           (${trade.id}, ${matchSwipe.card_id}, ${swiperId})
  `

  // Return match info
  const [theirCard] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c JOIN users u ON c.owner_id = u.id
    WHERE c.id = ${cardId}
  `
  const [myCard] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c JOIN users u ON c.owner_id = u.id
    WHERE c.id = ${matchSwipe.card_id}
  `

  return {
    matched: true,
    trade_id: trade.id,
    their_card: theirCard,
    my_card: myCard,
  }
}
```

- [ ] **Step 4: Add likes + likes-trade functions**

Append to `functions/lib/tradematch.js`:

```js
// ══════════════════════════════════════════════
// Likes
// ══════════════════════════════════════════════

export async function getLikes(sql, userId) {
  // Get swipes on my trade pile cards, grouped by user, filtered to valid/current
  return sql`
    SELECT s.id AS swipe_id, s.swiper_id, s.card_id, s.created_at,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level, c.card_data,
           u.discord_username AS swiper_name, u.discord_avatar AS swiper_avatar, u.discord_id AS swiper_discord_id
    FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${userId}
    JOIN cc_cards c ON s.card_id = c.id
    JOIN users u ON s.swiper_id = u.id
    WHERE s.card_owner_id = ${userId}
      AND c.owner_id = ${userId}
    ORDER BY s.created_at DESC
  `
}

export async function createTradeFromLike(sql, initiatorId, likerId, cardId) {
  // Verify the like exists and card is still valid
  const [swipe] = await sql`
    SELECT s.id FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${initiatorId}
    WHERE s.swiper_id = ${likerId} AND s.card_id = ${cardId} AND s.card_owner_id = ${initiatorId}
  `
  if (!swipe) throw new Error('Like not found or card no longer in trade pile')

  // Check outgoing match cap
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trades
    WHERE player_a_id = ${initiatorId} AND mode = 'match' AND status = 'active'
  `
  if (count >= TRADEMATCH_RULES.max_outgoing_matches) {
    throw new Error('Too many active matches')
  }

  // Create match trade
  let trade
  try {
    ;[trade] = await sql`
      INSERT INTO cc_trades (player_a_id, player_b_id, mode, status, match_swipe_b_id)
      VALUES (${initiatorId}, ${likerId}, 'match', 'active', ${swipe.id})
      RETURNING *
    `
  } catch (e) {
    if (e.code === '23505') throw new Error('Already in an active match with this user')
    throw e
  }

  // Pre-load the liked card (initiator offers it)
  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${trade.id}, ${cardId}, ${initiatorId})
  `

  return trade
}

// ══════════════════════════════════════════════
// Active Matches
// ══════════════════════════════════════════════

export async function getMatches(sql, userId) {
  return sql`
    SELECT t.*,
           u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${userId} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
      AND t.mode = 'match'
      AND t.status = 'active'
    ORDER BY t.created_at DESC
  `
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/lib/tradematch.js
git commit -m "feat(vault): add tradematch backend lib — trade pile, swipe feed, match detection, likes"
```

---

### Task 4: Tradematch API Endpoint

**Files:**
- Create: `functions/api/tradematch.js`

**Depends on:** Task 3

- [ ] **Step 1: Create `functions/api/tradematch.js`**

```js
// Tradematch API — Tinder-style card trading matchmaker
import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  getTradePile, addToTradePile, removeFromTradePile, getTradePileCount,
  getSwipeFeed, recordSwipe,
  getLikes, createTradeFromLike,
  getMatches,
  TRADEMATCH_RULES,
} from '../lib/tradematch.js'

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  const user = await requireAuth(event)
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'trade-pile': return await handleGetTradePile(sql, user)
        case 'swipe-feed': return await handleSwipeFeed(sql, user, event.queryStringParameters)
        case 'likes': return await handleLikes(sql, user)
        case 'matches': return await handleMatches(sql, user)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body || {}
      switch (action) {
        case 'trade-pile-add': return await handleTradePileAdd(sql, user, body)
        case 'trade-pile-remove': return await handleTradePileRemove(sql, user, body)
        case 'swipe': return await handleSwipe(sql, user, body)
        case 'likes-trade': return await handleLikesTrade(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    const msg = err.message || 'Internal error'
    const status = msg.includes('not found') || msg.includes('not available') ? 404
      : msg.includes('do not own') || msg.includes('Login') ? 403
      : msg.includes('Too many') || msg.includes('locked') || msg.includes('already') ? 409
      : 400
    return { statusCode: status, headers, body: JSON.stringify({ error: msg }) }
  }
}

async function handleGetTradePile(sql, user) {
  const [cards, count] = await Promise.all([
    getTradePile(sql, user.id),
    getTradePileCount(sql, user.id),
  ])
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ cards, count, minRequired: TRADEMATCH_RULES.min_trade_pile }),
  }
}

async function handleTradePileAdd(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  await addToTradePile(sql, user.id, parseInt(cardId))
  const count = await getTradePileCount(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count }) }
}

async function handleTradePileRemove(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  await removeFromTradePile(sql, user.id, parseInt(cardId))
  const count = await getTradePileCount(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count }) }
}

async function handleSwipeFeed(sql, user, params) {
  const count = await getTradePileCount(sql, user.id)
  if (count < TRADEMATCH_RULES.min_trade_pile) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ cards: [], locked: true, count, minRequired: TRADEMATCH_RULES.min_trade_pile }),
    }
  }
  const offset = parseInt(params.offset) || 0
  const cards = await getSwipeFeed(sql, user.id, offset)
  return { statusCode: 200, headers, body: JSON.stringify({ cards, locked: false }) }
}

async function handleSwipe(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }

  const count = await getTradePileCount(sql, user.id)
  if (count < TRADEMATCH_RULES.min_trade_pile) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need at least 20 cards in trade pile' }) }
  }

  const result = await recordSwipe(sql, user.id, parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleLikes(sql, user) {
  const likes = await getLikes(sql, user.id)
  // Group by swiper
  const grouped = {}
  for (const like of likes) {
    if (!grouped[like.swiper_id]) {
      grouped[like.swiper_id] = {
        user_id: like.swiper_id,
        username: like.swiper_name,
        avatar: like.swiper_avatar,
        discord_id: like.swiper_discord_id,
        cards: [],
      }
    }
    grouped[like.swiper_id].cards.push(like)
  }
  return { statusCode: 200, headers, body: JSON.stringify({ likes: Object.values(grouped) }) }
}

async function handleLikesTrade(sql, user, body) {
  const { likerId, cardId } = body
  if (!likerId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'likerId and cardId required' }) }
  const trade = await createTradeFromLike(sql, user.id, parseInt(likerId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade_id: trade.id }) }
}

async function handleMatches(sql, user) {
  const matches = await getMatches(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ matches }) }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/tradematch.js
git commit -m "feat(vault): add /api/tradematch endpoint — trade pile, swipe, likes, matches"
```

---

### Task 5: Frontend API Service

**Files:**
- Modify: `src/services/database.js` (~line 1272, after tradingService)

- [ ] **Step 1: Add `tradematchService` to `src/services/database.js`**

Add directly after the `tradingService` block (~line 1272), following the same inline pattern as all other services in this file:

```js
export const tradematchService = {
    async tradePile() {
        return apiCall('tradematch', { action: 'trade-pile' })
    },
    async tradePileAdd(cardId) {
        return apiPost('tradematch', { action: 'trade-pile-add' }, { cardId })
    },
    async tradePileRemove(cardId) {
        return apiPost('tradematch', { action: 'trade-pile-remove' }, { cardId })
    },
    async swipeFeed(offset = 0) {
        return apiCall('tradematch', { action: 'swipe-feed', offset: String(offset) })
    },
    async swipe(cardId) {
        return apiPost('tradematch', { action: 'swipe' }, { cardId })
    },
    async likes() {
        return apiCall('tradematch', { action: 'likes' })
    },
    async likesTrade(likerId, cardId) {
        return apiPost('tradematch', { action: 'likes-trade' }, { likerId, cardId })
    },
    async matches() {
        return apiCall('tradematch', { action: 'matches' })
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add tradematch frontend API service"
```

---

### Task 6: Trade Pile Manager Component

**Files:**
- Create: `src/pages/vault/tradematch/TradePileManager.jsx`

**Depends on:** Task 5

- [ ] **Step 1: Create the trade pile manager**

This is a grid of the user's collection cards with toggles to mark/unmark for trade. Shows progress toward the 20-card minimum.

Props from parent: `collection`, `lockedCardIds`, `tradePile` (Set of card IDs), `onToggle(cardId)`, `tradePileCount`, `filters`

Key behaviors:
- Cards already in Starting 5, binder, marketplace, or direct trade are disabled (greyed out)
- Toggle adds/removes from trade pile via API call
- Shows "X/20" progress bar
- Quick filter buttons for rarity, card type, holo

The component should render a grid of cards using the existing `GameCard` or similar card component pattern from the vault. Each card has a heart overlay toggle. Filter bar at top, progress counter below it.

Build this as a focused component (~150-200 lines). Use the same card grid pattern as `CCCollection.jsx`.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/TradePileManager.jsx
git commit -m "feat(vault): add TradePileManager component — mark cards for trade"
```

---

### Task 7: Premium Swiper Component

**Files:**
- Create: `src/pages/vault/tradematch/Swiper.jsx`

**Depends on:** Task 5

This is the most important UI component. Must feel premium like Tinder.

- [ ] **Step 1: Create the swiper with touch/mouse drag physics**

Key behaviors:
- Full-screen card display, one at a time
- Touch + mouse drag: card follows finger/cursor with rotation proportional to horizontal offset
- Shadow intensifies as card moves
- Release threshold: if dragged past ~30% of screen width, card flies off in that direction. Otherwise snaps back with spring animation.
- Velocity-based throw: fast flick sends card flying even if threshold not met
- After card exits, next card scales up from behind with a smooth spring
- Right-swipe: call `tradematchService.swipe(cardId)`, handle match response
- Left-swipe: just advance to next card
- Card content: full card art, name, rarity badge, holo type (color-coded), owner username + avatar
- Preload next 2-3 cards behind current card (slightly scaled down, stacked)
- When at 5 outgoing matches: show lock screen with romantic message
- When feed is empty: show "No more cards" state

Use CSS transforms for the drag (translateX, translateY, rotate). Use `requestAnimationFrame` or CSS transitions for the throw/snap animations. The snap-back should use a spring-like ease (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).

The card itself should show the actual card rendering (reuse the card component pattern from the vault), not just text.

Build as ~250-350 lines. All animation state managed via refs + transforms for 60fps performance.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/Swiper.jsx
git commit -m "feat(vault): add premium Tinder-style card swiper component"
```

---

### Task 8: Match Splash Component

**Files:**
- Create: `src/pages/vault/tradematch/MatchSplash.jsx`

**Depends on:** Task 7

- [ ] **Step 1: Create the "It's a Match!" splash screen**

Fullscreen overlay triggered when a swipe returns `matched: true`.

Content:
- Semi-transparent backdrop with blur
- "It's a Match!" text with glow/pulse animation
- Two cards displayed side by side (your card + their card) with a heart between them
- Cheesy tagline: "You and @{username} have a connection..."
- Floating hearts / sparkle particles in background (CSS animations, ~10-15 elements)
- Two buttons: "Open Trade" (goes to trade room) and "Keep Swiping" (dismisses)

Color scheme: pink/red gradients, warm glow effects. Use CSS keyframe animations for the hearts/sparkles. The cards should slide in from left and right with a spring animation.

Build as ~100-150 lines.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/MatchSplash.jsx
git commit -m "feat(vault): add It's a Match splash screen with romance animations"
```

---

### Task 9: Matches & Likes Component

**Files:**
- Create: `src/pages/vault/tradematch/MatchesAndLikes.jsx`

**Depends on:** Task 5

- [ ] **Step 1: Create the matches and likes view**

Two sections:

**Active Matches:**
- List of match-trades with partner avatar/name, status badge, time remaining
- Status: "Waiting for you" / "Waiting for them" / "Both confirmed"
- Tap → navigates to the async trade room (opens `CCTrading` in match mode, reusing trade room)
- Shows card thumbnails of what's in the trade

**Likes:**
- Grouped by user: avatar + name + list of your cards they liked
- Each user group has a "Start Trade" button
- Clicking calls `tradematchService.likesTrade(likerId, cardId)` with the first liked card

Romance touches:
- Heart icons for likes
- Pink accent for the likes section
- "Someone has their eye on your cards..." header
- Match count badge

Build as ~200-250 lines.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/MatchesAndLikes.jsx
git commit -m "feat(vault): add Matches & Likes view with romance theme"
```

---

### Task 10: Tradematch Tab Orchestrator + Vault Integration

**Files:**
- Create: `src/pages/vault/CCTradematch.jsx`
- Modify: `src/pages/vault/VaultTabBar.jsx:4-9` (add tab)
- Modify: `src/pages/vault/VaultContext.jsx` (add tradematch state)

**Depends on:** Tasks 6, 7, 8, 9

- [ ] **Step 1: Create `src/pages/vault/CCTradematch.jsx`**

Top-level orchestrator with 3 sub-views and a tab switcher:

```
[Trade Pile] [Swiper] [Matches]
```

State managed here:
- `tradePile`: Set of card IDs in trade pile
- `tradePileCount`: number
- `feedCards`: array from swipe feed
- `matchResult`: current match (for splash screen)
- `subView`: 'pile' | 'swiper' | 'matches'

Loads trade pile on mount. Passes data down to child components.

Build as ~150-200 lines — just state + routing + data fetching, all UI is in children.

- [ ] **Step 2: Add Tradematch tab to `VaultTabBar.jsx`**

Import `Heart` from lucide-react. Add to the tabs array (it'll be a secondary tab under "More"):

The parent that renders `VaultTabBar` needs to include `{ key: 'tradematch', label: 'Tradematch', icon: Heart }` in its tabs array. Find where tabs are defined and add it.

- [ ] **Step 3: Add Tradematch state to `VaultContext.jsx`**

Add `matchTradeCount` state (number of active match-trades) so the tab bar can show a badge.

Add to the vault load response: query `cc_trades` for `mode = 'match' AND status = 'active'` count. This requires a small addition to `functions/api/vault.js` load handler.

- [ ] **Step 4: Wire up in the parent vault page**

Find where the vault renders tabs/content (the component that switches between `CCCollection`, `CCTrading`, `CCMarketplace`, etc.) and add the `CCTradematch` case for `key === 'tradematch'`.

- [ ] **Step 5: Test the full flow**

Run: `npm start`

Manual test:
1. Open Vault → More → Tradematch
2. Mark 20+ cards for trade pile
3. Enter swiper, see cards, swipe left/right
4. Check likes tab
5. Verify direct trading still works separately

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/CCTradematch.jsx src/pages/vault/tradematch/ src/pages/vault/VaultTabBar.jsx src/pages/vault/VaultContext.jsx functions/api/vault.js
git commit -m "feat(vault): integrate Tradematch tab into Vault — pile, swiper, matches, likes"
```

---

### Task 11: Trade Pile Auto-Removal on Card Slot

**Files:**
- Modify: `functions/lib/starting-five.js` (slotCard, slotConsumable)
- Modify: `functions/api/vault.js` (handleBinderSlot)
- Modify: `functions/lib/marketplace.js` (createListing)

**Depends on:** Task 1

- [ ] **Step 1: Add trade pile removal to Starting 5 slot functions**

In `functions/lib/starting-five.js`, after a card is successfully slotted into Starting 5 (both `slotCard` and `slotConsumable`), add:

```js
// Remove from trade pile if present
await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`
```

- [ ] **Step 2: Add trade pile removal to binder slot**

In `functions/api/vault.js` `handleBinderSlot`, after the card is slotted into the binder, add the same DELETE.

- [ ] **Step 3: Add trade pile removal to marketplace listing**

In `functions/lib/marketplace.js` `createListing`, after a card listing is created, add the same DELETE.

- [ ] **Step 4: Commit**

```bash
git add functions/lib/starting-five.js functions/api/vault.js functions/lib/marketplace.js
git commit -m "fix(vault): auto-remove cards from trade pile when slotted into S5/binder/marketplace"
```

---

### Task 12: Async Trade Room — Match Mode Behavior

**Files:**
- Modify: `functions/lib/trading.js` (pollTrade, confirmTrade)
- Modify: `functions/api/trading.js` (handlePoll)

**Depends on:** Task 2

- [ ] **Step 1: Add conflict detection to `pollTrade`**

In `functions/lib/trading.js` `pollTrade` (~line 447), for match-mode trades, check if any cards in the trade have been traded away or are no longer owned by the offerer. If conflict detected, auto-cancel:

After fetching the trade and cards, add before the heartbeat update:

```js
if (trade.mode === 'match') {
  // Check 24h expiry
  const created = new Date(trade.created_at).getTime()
  if (Date.now() - created > 24 * 60 * 60 * 1000) {
    await sql`UPDATE cc_trades SET status = 'expired', updated_at = NOW() WHERE id = ${tradeId}`
    trade.status = 'expired'
    return { trade, cards: [], packs: [] }
  }

  // Check for card conflicts (ownership changed, card slotted elsewhere)
  for (const card of cards) {
    const [current] = await sql`SELECT owner_id FROM cc_cards WHERE id = ${card.card_id}`
    if (!current || current.owner_id !== card.offered_by) {
      await sql`UPDATE cc_trades SET status = 'cancelled', updated_at = NOW() WHERE id = ${tradeId}`
      trade.status = 'cancelled'
      return { trade, cards: [], packs: [] }
    }
  }
}
```

- [ ] **Step 2: Add mode to poll response**

In `functions/api/trading.js` `handlePoll`, include `trade.mode` in the `formatTrade` output so the frontend knows whether to render as async or real-time.

- [ ] **Step 3: Commit**

```bash
git add functions/lib/trading.js functions/api/trading.js
git commit -m "feat(vault): add match-mode conflict detection and expiry to trade poll"
```

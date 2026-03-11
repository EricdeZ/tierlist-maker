# Card Clash Trading System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct player-to-player card + Core trading via a live polling-based trade room.

**Architecture:** New DB tables `cc_trades` + `cc_trade_cards`, new API endpoint `trading.js` with lib `trading.js`, new frontend `CCTrading.jsx` tab. Polling every 3s keeps trade state in sync. Trades lock cards from marketplace/other trades. Atomic swap on dual-confirm via `transaction()`.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React, Tailwind CSS 4, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-10-vault-trading-design.md`

---

## Chunk 1: Database + Backend Core

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/084-trading.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Card Clash: Player-to-player trading

CREATE TABLE cc_trades (
    id SERIAL PRIMARY KEY,
    player_a_id INTEGER NOT NULL REFERENCES users(id),
    player_b_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'waiting',
    player_a_core INTEGER NOT NULL DEFAULT 0,
    player_b_core INTEGER NOT NULL DEFAULT 0,
    player_a_ready BOOLEAN NOT NULL DEFAULT false,
    player_b_ready BOOLEAN NOT NULL DEFAULT false,
    player_a_confirmed BOOLEAN NOT NULL DEFAULT false,
    player_b_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_polled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT cc_trades_not_self CHECK (player_a_id != player_b_id)
);

CREATE TABLE cc_trade_cards (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL REFERENCES cc_trades(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cc_cards(id),
    offered_by INTEGER NOT NULL REFERENCES users(id),
    UNIQUE(trade_id, card_id)
);

-- Max 1 active/waiting trade per user (as initiator or recipient)
CREATE UNIQUE INDEX idx_cc_trades_player_a_active
    ON cc_trades(player_a_id) WHERE status IN ('waiting', 'active');
CREATE UNIQUE INDEX idx_cc_trades_player_b_active
    ON cc_trades(player_b_id) WHERE status IN ('waiting', 'active');

-- Lookup indexes
CREATE INDEX idx_cc_trades_status ON cc_trades(status);
CREATE INDEX idx_cc_trade_cards_trade ON cc_trade_cards(trade_id);
CREATE INDEX idx_cc_trade_cards_card ON cc_trade_cards(card_id);
```

- [ ] **Step 2: Run the migration**

Run against your local/dev database:
```bash
# Use your standard migration method (psql, etc.)
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/084-trading.sql
git commit -m "feat(vault): add trading tables migration"
```

---

### Task 2: Trading Library — Core Logic

**Files:**
- Create: `functions/lib/trading.js`

Reference patterns:
- `functions/lib/marketplace.js` for `grantEmber` usage, `FOR UPDATE` locking
- `functions/lib/ember.js` for `grantEmber` signature

- [ ] **Step 1: Create the trading library with constants and helpers**

```js
// Card Clash Trading — direct player-to-player card + Core swaps
import { grantEmber, ensureEmberBalance } from './ember.js'

export const TRADE_RULES = {
  max_cards_per_side: 10,
  expiry_minutes: 2,
}

// Check if a card is locked in an active/waiting trade
export async function isCardInTrade(sql, cardId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  return !!row
}

// Expire stale trades (called on poll and on Vault load)
export async function expireStale(sql) {
  await sql`
    UPDATE cc_trades
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('waiting', 'active')
      AND last_polled_at < NOW() - INTERVAL '${TRADE_RULES.expiry_minutes} minutes'
  `
}
```

Wait — the interval with template literal won't work with neon tagged templates. Fix:

```js
export async function expireStale(sql) {
  const mins = TRADE_RULES.expiry_minutes
  await sql`
    UPDATE cc_trades
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('waiting', 'active')
      AND last_polled_at < NOW() - make_interval(mins => ${mins})
  `
}
```

- [ ] **Step 2: Add createTrade**

```js
export async function createTrade(sql, userId, targetUserId) {
  if (userId === targetUserId) throw new Error('Cannot trade with yourself')

  // Check neither user has an active/waiting trade
  const [existing] = await sql`
    SELECT id FROM cc_trades
    WHERE status IN ('waiting', 'active')
      AND (player_a_id = ${userId} OR player_b_id = ${userId}
           OR player_a_id = ${targetUserId} OR player_b_id = ${targetUserId})
    LIMIT 1
  `
  if (existing) throw new Error('You or the target user already has an active trade')

  // Verify target user exists
  const [target] = await sql`SELECT id FROM users WHERE id = ${targetUserId}`
  if (!target) throw new Error('User not found')

  const [trade] = await sql`
    INSERT INTO cc_trades (player_a_id, player_b_id)
    VALUES (${userId}, ${targetUserId})
    RETURNING *
  `
  return trade
}
```

- [ ] **Step 3: Add joinTrade and cancelTrade**

```js
export async function joinTrade(sql, userId, tradeId) {
  const [trade] = await sql`
    UPDATE cc_trades
    SET status = 'active', updated_at = NOW(), last_polled_at = NOW()
    WHERE id = ${tradeId} AND player_b_id = ${userId} AND status = 'waiting'
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or already started')
  return trade
}

export async function cancelTrade(sql, userId, tradeId) {
  const [trade] = await sql`
    UPDATE cc_trades
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${tradeId}
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
      AND status IN ('waiting', 'active')
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or already closed')
  return trade
}
```

- [ ] **Step 4: Add addCard and removeCard**

These use transactions for card locking safety. The API layer will wrap them in `transaction()`.

```js
export async function addCard(tx, userId, tradeId, cardId) {
  // Verify trade is active and user is a participant
  const [trade] = await tx`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  // Lock card row, verify ownership
  const [card] = await tx`
    SELECT id, owner_id FROM cc_cards WHERE id = ${cardId} FOR UPDATE
  `
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check card not in another active trade
  const [locked] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.id != ${tradeId}
    LIMIT 1
  `
  if (locked) throw new Error('Card is locked in another trade')

  // Check card not listed on marketplace
  const [listed] = await tx`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
    LIMIT 1
  `
  if (listed) throw new Error('Card is listed on the marketplace')

  // Check max cards per side
  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId}
  `
  if (count >= TRADE_RULES.max_cards_per_side) {
    throw new Error(`Maximum ${TRADE_RULES.max_cards_per_side} cards per side`)
  }

  await tx`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${tradeId}, ${cardId}, ${userId})
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

export async function removeCard(sql, userId, tradeId, cardId) {
  const [removed] = await sql`
    DELETE FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND card_id = ${cardId} AND offered_by = ${userId}
    RETURNING id
  `
  if (!removed) throw new Error('Card not found in your trade offer')

  await sql`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
  `
}
```

- [ ] **Step 5: Add setCore and setReady**

```js
export async function setCore(sql, userId, tradeId, amount) {
  if (amount < 0) throw new Error('Core amount cannot be negative')

  const coreCol = await getPlayerCoreCol(sql, userId, tradeId)

  const [trade] = await sql`
    UPDATE cc_trades
    SET ${sql(coreCol)} = ${amount},
        player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or not active')
  return trade
}

export async function setReady(sql, userId, tradeId) {
  const readyCol = await getPlayerReadyCol(sql, userId, tradeId)

  const [trade] = await sql`
    UPDATE cc_trades
    SET ${sql(readyCol)} = true, updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or not active')
  return trade
}

// Helper: determine which column to update based on which player the user is
async function getPlayerCoreCol(sql, userId, tradeId) {
  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId}`
  if (!trade) throw new Error('Trade not found')
  if (trade.player_a_id === userId) return 'player_a_core'
  if (trade.player_b_id === userId) return 'player_b_core'
  throw new Error('You are not in this trade')
}

async function getPlayerReadyCol(sql, userId, tradeId) {
  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId}`
  if (!trade) throw new Error('Trade not found')
  if (trade.player_a_id === userId) return 'player_a_ready'
  if (trade.player_b_id === userId) return 'player_b_ready'
  throw new Error('You are not in this trade')
}
```

**Note on `sql(colName)` dynamic columns:** Neon's tagged template `sql` function supports `sql(identifier)` for safe dynamic column references. If this doesn't work with neon's driver, use conditional SQL instead:

```js
// Alternative: two separate queries based on which player
if (trade.player_a_id === userId) {
  await sql`UPDATE cc_trades SET player_a_core = ${amount}, ... WHERE id = ${tradeId}`
} else {
  await sql`UPDATE cc_trades SET player_b_core = ${amount}, ... WHERE id = ${tradeId}`
}
```

- [ ] **Step 6: Add confirmTrade (the atomic swap)**

```js
export async function confirmTrade(tx, userId, tradeId) {
  // Lock trade row
  const [trade] = await tx`
    SELECT * FROM cc_trades WHERE id = ${tradeId} AND status = 'active' FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  const isA = trade.player_a_id === userId
  const isB = trade.player_b_id === userId
  if (!isA && !isB) throw new Error('You are not in this trade')

  // Both must be ready
  if (!trade.player_a_ready || !trade.player_b_ready) {
    throw new Error('Both players must be ready before confirming')
  }

  // Set this player's confirmed flag
  if (isA && !trade.player_a_confirmed) {
    await tx`UPDATE cc_trades SET player_a_confirmed = true, updated_at = NOW() WHERE id = ${tradeId}`
    trade.player_a_confirmed = true
  } else if (isB && !trade.player_b_confirmed) {
    await tx`UPDATE cc_trades SET player_b_confirmed = true, updated_at = NOW() WHERE id = ${tradeId}`
    trade.player_b_confirmed = true
  }

  // If only one confirmed so far, return — waiting for the other
  if (!trade.player_a_confirmed || !trade.player_b_confirmed) {
    return { status: 'waiting_for_confirm', trade }
  }

  // ═══ BOTH CONFIRMED — EXECUTE SWAP ═══

  // Get all trade cards
  const cards = await tx`SELECT * FROM cc_trade_cards WHERE trade_id = ${tradeId}`
  const aCards = cards.filter(c => c.offered_by === trade.player_a_id)
  const bCards = cards.filter(c => c.offered_by === trade.player_b_id)

  // Must have at least something to trade
  if (aCards.length === 0 && bCards.length === 0 && trade.player_a_core === 0 && trade.player_b_core === 0) {
    throw new Error('Trade is empty — add cards or Core')
  }

  // Verify card ownership still valid
  for (const tc of cards) {
    const [card] = await tx`SELECT owner_id FROM cc_cards WHERE id = ${tc.card_id} FOR UPDATE`
    if (!card || card.owner_id !== tc.offered_by) {
      throw new Error('A card in the trade is no longer owned by the trader')
    }
  }

  // Lock ember balances, verify Core affordability
  if (trade.player_a_core > 0) {
    await ensureEmberBalance(tx, trade.player_a_id)
    const [balA] = await tx`
      SELECT balance FROM ember_balances WHERE user_id = ${trade.player_a_id} FOR UPDATE
    `
    if (!balA || balA.balance < trade.player_a_core) {
      throw new Error('Player A cannot afford their Core offer')
    }
  }
  if (trade.player_b_core > 0) {
    await ensureEmberBalance(tx, trade.player_b_id)
    const [balB] = await tx`
      SELECT balance FROM ember_balances WHERE user_id = ${trade.player_b_id} FOR UPDATE
    `
    if (!balB || balB.balance < trade.player_b_core) {
      throw new Error('Player B cannot afford their Core offer')
    }
  }

  // Transfer cards: A's cards → B, B's cards → A
  if (aCards.length > 0) {
    const aCardIds = aCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_b_id} WHERE id = ANY(${aCardIds})`
  }
  if (bCards.length > 0) {
    const bCardIds = bCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_a_id} WHERE id = ANY(${bCardIds})`
  }

  // Transfer Core
  if (trade.player_a_core > 0) {
    await grantEmber(tx, trade.player_a_id, 'cc_trade', -trade.player_a_core, `Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_b_id, 'cc_trade', trade.player_a_core, `Trade #${tradeId}: received Core`, tradeId)
  }
  if (trade.player_b_core > 0) {
    await grantEmber(tx, trade.player_b_id, 'cc_trade', -trade.player_b_core, `Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_a_id, 'cc_trade', trade.player_b_core, `Trade #${tradeId}: received Core`, tradeId)
  }

  // Mark trade completed
  const [completed] = await tx`
    UPDATE cc_trades
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${tradeId}
    RETURNING *
  `

  return {
    status: 'completed',
    trade: completed,
    cardsSwapped: { aToB: aCards.length, bToA: bCards.length },
    coreSwapped: { aToB: trade.player_a_core, bToA: trade.player_b_core },
  }
}
```

- [ ] **Step 7: Add pollTrade (read state + heartbeat)**

```js
export async function pollTrade(sql, userId, tradeId) {
  // Update heartbeat
  await sql`
    UPDATE cc_trades SET last_polled_at = NOW()
    WHERE id = ${tradeId}
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
      AND status IN ('waiting', 'active')
  `

  // Check for expiry first
  await expireStale(sql)

  // Get trade state
  const [trade] = await sql`
    SELECT t.*,
           ua.discord_username AS player_a_name, ua.discord_avatar AS player_a_avatar, ua.discord_id AS player_a_discord_id,
           ub.discord_username AS player_b_name, ub.discord_avatar AS player_b_avatar, ub.discord_id AS player_b_discord_id
    FROM cc_trades t
    JOIN users ua ON t.player_a_id = ua.id
    JOIN users ub ON t.player_b_id = ub.id
    WHERE t.id = ${tradeId}
      AND (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // Get cards in trade
  const cards = await sql`
    SELECT tc.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect,
           c.image_url, c.card_type, c.card_data, c.serial_number, c.def_id
    FROM cc_trade_cards tc
    JOIN cc_cards c ON tc.card_id = c.id
    WHERE tc.trade_id = ${tradeId}
  `

  return { trade, cards }
}
```

- [ ] **Step 8: Commit**

```bash
git add functions/lib/trading.js
git commit -m "feat(vault): add trading library with core logic"
```

---

### Task 3: Trading API Endpoint

**Files:**
- Create: `functions/api/trading.js`

Reference: `functions/api/marketplace.js` for action-routing pattern, `functions/lib/db.js` for `transaction()`.

- [ ] **Step 1: Create the endpoint with GET actions**

```js
// Card Clash Trading API — direct player-to-player card + Core swaps
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  createTrade, joinTrade, cancelTrade,
  addCard, removeCard, setCore, setReady,
  confirmTrade, pollTrade, expireStale,
} from '../lib/trading.js'

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
        case 'poll': return await handlePoll(sql, user, event.queryStringParameters)
        case 'pending': return await handlePending(sql, user)
        case 'history': return await handleHistory(sql, user)
        case 'search-users': return await handleSearchUsers(sql, event.queryStringParameters)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create': return await handleCreate(sql, user, body)
        case 'join': return await handleJoin(sql, user, body)
        case 'add-card': return await handleAddCard(user, body)
        case 'remove-card': return await handleRemoveCard(sql, user, body)
        case 'set-core': return await handleSetCore(sql, user, body)
        case 'ready': return await handleReady(sql, user, body)
        case 'confirm': return await handleConfirm(user, body)
        case 'cancel': return await handleCancel(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('trading error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Poll trade state ═══
async function handlePoll(sql, user, params) {
  const { tradeId } = params
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const { trade, cards } = await pollTrade(sql, user.id, parseInt(tradeId))

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trade: formatTrade(trade, user.id), cards: cards.map(formatTradeCard) }),
  }
}

// ═══ GET: Pending invites ═══
async function handlePending(sql, user) {
  await expireStale(sql)

  const trades = await sql`
    SELECT t.*, u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${user.id} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('waiting', 'active')
    ORDER BY t.created_at DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trades: trades.map(t => formatPendingTrade(t, user.id)) }),
  }
}

// ═══ GET: Trade history ═══
async function handleHistory(sql, user) {
  const trades = await sql`
    SELECT t.*, u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${user.id} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('completed', 'cancelled', 'expired')
    ORDER BY t.updated_at DESC
    LIMIT 20
  `
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trades: trades.map(t => formatPendingTrade(t, user.id)) }),
  }
}

// ═══ GET: Search users ═══
async function handleSearchUsers(sql, params) {
  const { q } = params
  if (!q || q.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query must be at least 2 characters' }) }
  }

  const users = await sql`
    SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id
    FROM users u
    WHERE u.discord_username ILIKE ${'%' + q + '%'}
    ORDER BY u.discord_username
    LIMIT 20
  `
  return { statusCode: 200, headers, body: JSON.stringify({ users }) }
}

// ═══ POST handlers ═══
async function handleCreate(sql, user, body) {
  const { targetUserId } = body
  if (!targetUserId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUserId required' }) }

  const trade = await createTrade(sql, user.id, parseInt(targetUserId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade: { id: trade.id, status: trade.status } }) }
}

async function handleJoin(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const trade = await joinTrade(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade: { id: trade.id, status: trade.status } }) }
}

async function handleAddCard(user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }

  await transaction(async (tx) => {
    await addCard(tx, user.id, parseInt(tradeId), parseInt(cardId))
  })
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleRemoveCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }

  await removeCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleSetCore(sql, user, body) {
  const { tradeId, amount } = body
  if (!tradeId || amount === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and amount required' }) }

  await setCore(sql, user.id, parseInt(tradeId), parseInt(amount))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleReady(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  await setReady(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleConfirm(user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const result = await transaction(async (tx) => {
    return await confirmTrade(tx, user.id, parseInt(tradeId))
  })
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleCancel(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  await cancelTrade(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ Formatters ═══
function formatTrade(trade, userId) {
  const isA = trade.player_a_id === userId
  return {
    id: trade.id,
    status: trade.status,
    myCore: isA ? trade.player_a_core : trade.player_b_core,
    theirCore: isA ? trade.player_b_core : trade.player_a_core,
    myReady: isA ? trade.player_a_ready : trade.player_b_ready,
    theirReady: isA ? trade.player_b_ready : trade.player_a_ready,
    myConfirmed: isA ? trade.player_a_confirmed : trade.player_b_confirmed,
    theirConfirmed: isA ? trade.player_b_confirmed : trade.player_a_confirmed,
    partnerId: isA ? trade.player_b_id : trade.player_a_id,
    partnerName: isA ? trade.player_b_name : trade.player_a_name,
    partnerAvatar: avatarUrl(
      isA ? trade.player_b_discord_id : trade.player_a_discord_id,
      isA ? trade.player_b_avatar : trade.player_a_avatar
    ),
    createdAt: trade.created_at,
    updatedAt: trade.updated_at,
  }
}

function formatPendingTrade(trade, userId) {
  const isA = trade.player_a_id === userId
  return {
    id: trade.id,
    status: trade.status,
    isInitiator: isA,
    partnerId: isA ? trade.player_b_id : trade.player_a_id,
    partnerName: trade.partner_name,
    partnerAvatar: avatarUrl(trade.partner_discord_id, trade.partner_avatar),
    createdAt: trade.created_at,
    completedAt: trade.completed_at,
  }
}

function formatTradeCard(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    offeredBy: row.offered_by,
    card: {
      godId: row.god_id,
      godName: row.god_name,
      godClass: row.god_class,
      role: row.role,
      rarity: row.rarity,
      holoEffect: row.holo_effect,
      imageUrl: row.image_url,
      cardType: row.card_type,
      cardData: row.card_data,
      serialNumber: row.serial_number,
      defId: row.def_id,
    },
  }
}

function avatarUrl(discordId, avatar) {
  return discordId && avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.webp?size=64`
    : null
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/trading.js
git commit -m "feat(vault): add trading API endpoint"
```

---

### Task 4: Cross-Cutting Backend Changes

**Files:**
- Modify: `functions/api/vault.js` (handleLoad — add pendingTradeCount + expire stale trades)
- Modify: `functions/lib/marketplace.js` (createListing — add trade lock check)

- [ ] **Step 1: Add pendingTradeCount to vault handleLoad**

In `functions/api/vault.js`, inside `handleLoad`, add to the `Promise.all`:

```js
// Add after the existing 5 queries in the Promise.all:
sql`
  SELECT COUNT(*)::int AS count FROM cc_trades
  WHERE (player_b_id = ${user.id} AND status = 'waiting')
     OR ((player_a_id = ${user.id} OR player_b_id = ${user.id}) AND status = 'active')
`,
```

Also add expiry cleanup at the top of handleLoad:

```js
// At the top of handleLoad, before the Promise.all:
await sql`
  UPDATE cc_trades SET status = 'expired', updated_at = NOW()
  WHERE status IN ('waiting', 'active')
    AND last_polled_at < NOW() - make_interval(mins => 2)
`
```

Add `pendingTradeCount` to the response body alongside existing fields:

```js
pendingTradeCount: tradeCount[0]?.count || 0,
```

- [ ] **Step 2: Add trade lock check to marketplace createListing**

In `functions/lib/marketplace.js`, inside `createListing`, after the ownership check and before the listing limit check, add:

```js
// Check card not locked in active trade
const [tradeLock] = await sql`
  SELECT tc.id FROM cc_trade_cards tc
  JOIN cc_trades t ON tc.trade_id = t.id
  WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
  LIMIT 1
`
if (tradeLock) throw new Error('Card is locked in an active trade')
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault.js functions/lib/marketplace.js
git commit -m "feat(vault): add trade count to load, trade lock to marketplace"
```

---

## Chunk 2: Frontend

### Task 5: Service Layer

**Files:**
- Modify: `src/services/database.js` (add `tradingService`)

- [ ] **Step 1: Add tradingService after marketplaceService**

Add this block after the `marketplaceService` export (around line 1024):

```js
export const tradingService = {
    async pending() {
        return apiCall('trading', { action: 'pending' })
    },
    async poll(tradeId) {
        return apiCall('trading', { action: 'poll', tradeId })
    },
    async history() {
        return apiCall('trading', { action: 'history' })
    },
    async searchUsers(q) {
        return apiCall('trading', { action: 'search-users', q })
    },
    async create(targetUserId) {
        return apiPost('trading', { action: 'create' }, { targetUserId })
    },
    async join(tradeId) {
        return apiPost('trading', { action: 'join' }, { tradeId })
    },
    async addCard(tradeId, cardId) {
        return apiPost('trading', { action: 'add-card' }, { tradeId, cardId })
    },
    async removeCard(tradeId, cardId) {
        return apiPost('trading', { action: 'remove-card' }, { tradeId, cardId })
    },
    async setCore(tradeId, amount) {
        return apiPost('trading', { action: 'set-core' }, { tradeId, amount })
    },
    async ready(tradeId) {
        return apiPost('trading', { action: 'ready' }, { tradeId })
    },
    async confirm(tradeId) {
        return apiPost('trading', { action: 'confirm' }, { tradeId })
    },
    async cancel(tradeId) {
        return apiPost('trading', { action: 'cancel' }, { tradeId })
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add tradingService to API client"
```

---

### Task 6: Vault Context + Page Integration

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx` (add `pendingTradeCount`)
- Modify: `src/pages/VaultPage.jsx` (add Trade tab with badge)

- [ ] **Step 1: Add pendingTradeCount to VaultContext**

In `VaultContext.jsx`, add state:

```js
const [pendingTradeCount, setPendingTradeCount] = useState(0)
```

In the `useEffect` that calls `vaultService.load()`, set it:

```js
setPendingTradeCount(ccData.pendingTradeCount || 0)
```

Add to the Provider value:

```js
pendingTradeCount, setPendingTradeCount,
```

- [ ] **Step 2: Add Trade tab to VaultPage**

In `VaultPage.jsx`:

Add import:
```js
import { Handshake } from 'lucide-react'
```

Add lazy component:
```js
const CCTrading = lazy(() => import('./vault/CCTrading'))
```

Add to `TABS` array (after `market`):
```js
{ key: 'trade', label: 'Trade', icon: Handshake },
```

Add to `TAB_COMPONENTS`:
```js
trade: CCTrading,
```

For the badge, update the tab button rendering to show a notification dot when `pendingTradeCount > 0`. In the `VaultInner` component, get `pendingTradeCount` from context:

```js
const { testMode, setTestMode, loading, loaded, pendingTradeCount } = useVault()
```

In the tab button, after the icon + label, add:

```jsx
{tab.key === 'trade' && pendingTradeCount > 0 && (
    <span className="w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/VaultContext.jsx src/pages/VaultPage.jsx
git commit -m "feat(vault): add Trade tab with pending badge"
```

---

### Task 7: CCTrading.jsx — Main Trading Page

**Files:**
- Create: `src/pages/vault/CCTrading.jsx`

This is the largest frontend file. It has three sub-views: inbox (default), trade room (when in a trade), and history. The trade room polls every 3 seconds.

Reference: `src/pages/vault/CCMarketplace.jsx` for view-switching pattern, button styles, error/success display, and card rendering.

- [ ] **Step 1: Create CCTrading with inbox view and user search modal**

The inbox shows pending invites and a "Start Trade" button that opens a user search modal. When a user is selected, it creates a trade.

```jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import { useVault } from './VaultContext'
import { tradingService } from '../../services/database'
import { RARITIES } from '../../data/vault/economy'
import { Search, X, Handshake, Clock, Loader2, Check, ArrowRightLeft, Plus, History } from 'lucide-react'

export default function CCTrading() {
  const { user } = useAuth()
  const passionCtx = usePassion()
  const { collection, pendingTradeCount, setPendingTradeCount } = useVault()

  const [view, setView] = useState('inbox') // 'inbox' | 'room' | 'history'
  const [pending, setPending] = useState([])
  const [historyTrades, setHistoryTrades] = useState([])
  const [activeTrade, setActiveTrade] = useState(null) // trade ID when in room
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchModal, setSearchModal] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const data = await tradingService.pending()
      setPending(data.trades || [])
      // Check if user has an active trade — auto-enter room
      const active = (data.trades || []).find(t => t.status === 'active')
      if (active) {
        setActiveTrade(active.id)
        setView('room')
      }
    } catch (err) {
      console.error('Failed to fetch pending trades:', err)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const data = await tradingService.history()
      setHistoryTrades(data.trades || [])
    } catch (err) {
      console.error('Failed to fetch trade history:', err)
    }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  useEffect(() => {
    if (view === 'history') fetchHistory()
  }, [view, fetchHistory])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000)
      return () => clearTimeout(t)
    }
  }, [success])

  const handleCreate = async (targetUserId) => {
    setError('')
    try {
      const data = await tradingService.create(targetUserId)
      setSearchModal(false)
      setSuccess('Trade invite sent!')
      fetchPending()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleJoin = async (tradeId) => {
    setError('')
    try {
      await tradingService.join(tradeId)
      setActiveTrade(tradeId)
      setView('room')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTradeEnd = () => {
    setActiveTrade(null)
    setView('inbox')
    fetchPending()
    passionCtx?.refreshBalance?.()
  }

  return (
    <div className="pb-12">
      {(error || success) && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
          error ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {error || success}
          <button onClick={() => { setError(''); setSuccess('') }} className="ml-2 opacity-50 hover:opacity-100">
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      )}

      {view !== 'room' && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView('inbox')}
            className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              view === 'inbox'
                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                : 'text-white/40 border-white/10 hover:text-white/60'
            }`}
          >
            <Handshake className="w-4 h-4" />
            Trades
            {pending.filter(t => t.status === 'waiting' && !t.isInitiator).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setView('history')}
            className={`cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              view === 'history'
                ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border-[var(--cd-cyan)]/30'
                : 'text-white/40 border-white/10 hover:text-white/60'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => setSearchModal(true)}
            className="cd-head flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer border bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/20"
          >
            <Plus className="w-4 h-4" />
            Start Trade
          </button>
        </div>
      )}

      {view === 'inbox' && (
        <InboxView
          trades={pending}
          onJoin={handleJoin}
          onCancel={async (id) => {
            try {
              await tradingService.cancel(id)
              fetchPending()
            } catch (err) { setError(err.message) }
          }}
          onEnterRoom={(id) => { setActiveTrade(id); setView('room') }}
          userId={user?.id}
        />
      )}

      {view === 'history' && <HistoryView trades={historyTrades} />}

      {view === 'room' && activeTrade && (
        <TradeRoom
          tradeId={activeTrade}
          collection={collection}
          userId={user?.id}
          coreBalance={passionCtx?.ember?.balance ?? 0}
          onEnd={handleTradeEnd}
          setError={setError}
          setSuccess={setSuccess}
        />
      )}

      {searchModal && (
        <UserSearchModal
          onClose={() => setSearchModal(false)}
          onSelect={handleCreate}
          currentUserId={user?.id}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add InboxView and HistoryView components**

```jsx
function InboxView({ trades, onJoin, onCancel, onEnterRoom, userId }) {
  const invites = trades.filter(t => t.status === 'waiting' && !t.isInitiator)
  const sent = trades.filter(t => t.status === 'waiting' && t.isInitiator)
  const active = trades.filter(t => t.status === 'active')

  if (trades.length === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <Handshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="cd-head text-lg">No active trades</p>
        <p className="text-sm mt-1">Start a trade with another player</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-emerald-400 mb-3 tracking-wider">Active Trade</h3>
          {active.map(t => (
            <TradeRow key={t.id} trade={t} action="Enter" onAction={() => onEnterRoom(t.id)} />
          ))}
        </div>
      )}

      {invites.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-[var(--cd-magenta)] mb-3 tracking-wider">Incoming Invites</h3>
          {invites.map(t => (
            <TradeRow key={t.id} trade={t} action="Join" onAction={() => onJoin(t.id)} onCancel={() => onCancel(t.id)} />
          ))}
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h3 className="cd-head text-sm text-white/40 mb-3 tracking-wider">Sent Invites</h3>
          {sent.map(t => (
            <TradeRow key={t.id} trade={t} action="Waiting..." actionDisabled onCancel={() => onCancel(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade, action, actionDisabled, onAction, onCancel }) {
  return (
    <div className="flex items-center gap-4 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4 mb-2">
      {trade.partnerAvatar && (
        <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
      )}
      <div className="flex-1">
        <div className="text-sm font-bold text-white">{trade.partnerName}</div>
        <div className="text-[10px] text-white/30">
          {new Date(trade.createdAt).toLocaleString()}
        </div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="cd-head text-xs font-bold uppercase tracking-wider px-4 py-2 rounded
            bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30
            hover:bg-[var(--cd-cyan)]/20 transition-all cursor-pointer
            disabled:opacity-50 disabled:cursor-default"
        >
          {action}
        </button>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="cd-head text-xs font-bold uppercase tracking-wider px-3 py-2 rounded
            text-red-400/60 border border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function HistoryView({ trades }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="cd-head text-lg">No trade history</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {trades.map(t => (
        <div key={t.id} className="flex items-center gap-4 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4 opacity-60">
          {t.partnerAvatar && (
            <img src={t.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{t.partnerName}</div>
            <div className="text-[10px] text-white/30">
              {new Date(t.completedAt || t.createdAt).toLocaleString()}
            </div>
          </div>
          <span className={`cd-head text-[10px] uppercase tracking-wider ${
            t.status === 'completed' ? 'text-emerald-400' : 'text-white/30'
          }`}>
            {t.status}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add UserSearchModal**

```jsx
function UserSearchModal({ onClose, onSelect, currentUserId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const doSearch = async () => {
    if (query.length < 2) return
    setSearching(true)
    setSearchError('')
    try {
      const data = await tradingService.searchUsers(query)
      setResults((data.users || []).filter(u => u.id !== currentUserId))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="cd-head text-lg text-[var(--cd-magenta)] tracking-wider mb-4">Start Trade</h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search by username..."
            className="flex-1 bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded placeholder-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/50"
            autoFocus
          />
          <button
            onClick={doSearch}
            disabled={query.length < 2}
            className="px-3 py-2 bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/30 rounded cursor-pointer hover:bg-[var(--cd-cyan)]/20 transition-all disabled:opacity-30"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {searchError && <div className="text-sm text-red-400 mb-3">{searchError}</div>}

        <div className="max-h-60 overflow-y-auto space-y-1">
          {searching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-[var(--cd-cyan)] animate-spin" />
            </div>
          ) : results.length > 0 ? (
            results.map(u => (
              <button
                key={u.id}
                onClick={() => onSelect(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--cd-edge)] transition-all cursor-pointer text-left"
              >
                {u.discord_avatar && u.discord_id ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.webp?size=32`}
                    alt="" className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10" />
                )}
                <span className="text-sm text-white">{u.discord_username}</span>
              </button>
            ))
          ) : query.length >= 2 && !searching ? (
            <div className="text-center py-4 text-white/30 text-sm">No users found</div>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-sm font-bold uppercase py-2 rounded border border-white/10 text-white/40 hover:text-white/60 transition-all cursor-pointer cd-head"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add TradeRoom component**

This is the core polling UI. Both players see the trade room, poll every 3 seconds.

```jsx
function TradeRoom({ tradeId, collection, userId, coreBalance, onEnd, setError, setSuccess }) {
  const [trade, setTrade] = useState(null)
  const [tradeCards, setTradeCards] = useState([])
  const [actionLoading, setActionLoading] = useState(false)
  const [coreInput, setCoreInput] = useState('')
  const pollRef = useRef(null)

  const poll = useCallback(async () => {
    try {
      const data = await tradingService.poll(tradeId)
      setTrade(data.trade)
      setTradeCards(data.cards || [])

      // If trade ended (completed, cancelled, expired), stop polling
      if (['completed', 'cancelled', 'expired'].includes(data.trade.status)) {
        if (data.trade.status === 'completed') setSuccess('Trade completed!')
        else if (data.trade.status === 'cancelled') setError('Trade was cancelled')
        else if (data.trade.status === 'expired') setError('Trade expired')
        clearInterval(pollRef.current)
        setTimeout(onEnd, 2000)
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }, [tradeId, onEnd, setError, setSuccess])

  useEffect(() => {
    poll() // initial fetch
    pollRef.current = setInterval(poll, 3000)
    return () => clearInterval(pollRef.current)
  }, [poll])

  const myCards = useMemo(() =>
    tradeCards.filter(tc => tc.offeredBy === userId),
  [tradeCards, userId])

  const theirCards = useMemo(() =>
    tradeCards.filter(tc => tc.offeredBy !== userId),
  [tradeCards, userId])

  const myCardIds = useMemo(() =>
    new Set(myCards.map(tc => tc.cardId)),
  [myCards])

  const availableCards = useMemo(() =>
    collection.filter(c => !myCardIds.has(c.id)),
  [collection, myCardIds])

  const handleAddCard = async (cardId) => {
    setActionLoading(true)
    try {
      await tradingService.addCard(tradeId, cardId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveCard = async (cardId) => {
    setActionLoading(true)
    try {
      await tradingService.removeCard(tradeId, cardId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetCore = async () => {
    const amount = parseInt(coreInput) || 0
    setActionLoading(true)
    try {
      await tradingService.setCore(tradeId, amount)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReady = async () => {
    setActionLoading(true)
    try {
      await tradingService.ready(tradeId)
      await poll()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirm = async () => {
    setActionLoading(true)
    try {
      const result = await tradingService.confirm(tradeId)
      if (result.status === 'completed') {
        setSuccess('Trade completed!')
        clearInterval(pollRef.current)
        setTimeout(onEnd, 2000)
      } else {
        await poll() // waiting for other player
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    try {
      await tradingService.cancel(tradeId)
      onEnd()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!trade) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[var(--cd-cyan)] animate-spin" />
      </div>
    )
  }

  const bothReady = trade.myReady && trade.theirReady
  const canConfirm = bothReady && !trade.myConfirmed

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {trade.partnerAvatar && (
            <img src={trade.partnerAvatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div>
            <span className="cd-head text-sm text-white/40 tracking-wider">Trading with</span>
            <span className="text-sm font-bold text-white ml-2">{trade.partnerName}</span>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="cd-head text-xs font-bold uppercase tracking-wider px-4 py-2 rounded
            text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          Cancel Trade
        </button>
      </div>

      {/* Trade area: two columns */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* My offer */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="cd-head text-sm text-[var(--cd-cyan)] tracking-wider">Your Offer</h3>
            {trade.myReady && <Check className="w-4 h-4 text-emerald-400" />}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 min-h-[100px]">
            {myCards.map(tc => (
              <TradeCardSlot
                key={tc.cardId}
                card={tc.card}
                onRemove={() => handleRemoveCard(tc.cardId)}
                disabled={actionLoading || trade.myReady}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              min="0"
              value={coreInput}
              onChange={(e) => setCoreInput(e.target.value)}
              placeholder="Core..."
              disabled={trade.myReady}
              className="flex-1 bg-[var(--cd-edge)] border border-[var(--cd-border)] text-orange-400 text-sm px-3 py-1.5 rounded placeholder-white/15 focus:outline-none cd-num disabled:opacity-50"
            />
            <button
              onClick={handleSetCore}
              disabled={actionLoading || trade.myReady}
              className="cd-head text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-[var(--cd-border)] text-white/40 hover:text-white/60 transition-all cursor-pointer disabled:opacity-30"
            >
              Set
            </button>
          </div>
          {trade.myCore > 0 && (
            <div className="text-sm text-orange-400 cd-num mb-3">+ {trade.myCore} Core</div>
          )}
          <div className="text-[10px] text-white/20 mb-3">Balance: {coreBalance} Core</div>

          {!trade.myReady ? (
            <button
              onClick={handleReady}
              disabled={actionLoading}
              className="w-full cd-head text-xs font-bold uppercase tracking-wider py-2 rounded
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
                hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              Ready
            </button>
          ) : canConfirm ? (
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="w-full cd-head text-xs font-bold uppercase tracking-wider py-2 rounded
                bg-[var(--cd-magenta)]/10 text-[var(--cd-magenta)] border border-[var(--cd-magenta)]/30
                hover:bg-[var(--cd-magenta)]/20 transition-all cursor-pointer disabled:opacity-50 animate-pulse"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Trade'}
            </button>
          ) : trade.myConfirmed ? (
            <div className="w-full text-center cd-head text-xs text-emerald-400/60 uppercase tracking-wider py-2">
              Waiting for partner...
            </div>
          ) : (
            <div className="w-full text-center cd-head text-xs text-emerald-400/60 uppercase tracking-wider py-2">
              <Check className="w-3 h-3 inline mr-1" /> Ready
            </div>
          )}
        </div>

        {/* Their offer */}
        <div className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="cd-head text-sm text-[var(--cd-magenta)] tracking-wider">Their Offer</h3>
            {trade.theirReady && <Check className="w-4 h-4 text-emerald-400" />}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 min-h-[100px]">
            {theirCards.map(tc => (
              <TradeCardSlot key={tc.cardId} card={tc.card} />
            ))}
          </div>

          {trade.theirCore > 0 && (
            <div className="text-sm text-orange-400 cd-num mb-3">+ {trade.theirCore} Core</div>
          )}

          <div className="text-center text-[10px] text-white/30 cd-head uppercase tracking-wider py-2">
            {trade.theirReady ? (
              <span className="text-emerald-400"><Check className="w-3 h-3 inline mr-1" /> Ready</span>
            ) : trade.theirConfirmed ? (
              <span className="text-emerald-400">Confirmed</span>
            ) : (
              'Not ready'
            )}
          </div>
        </div>
      </div>

      {/* Collection picker */}
      <div className="border-t border-[var(--cd-border)] pt-4">
        <h3 className="cd-head text-sm text-white/40 tracking-wider mb-3">
          Your Collection — click to add
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[300px] overflow-y-auto">
          {availableCards.map(card => {
            const rarityInfo = RARITIES[card.rarity] || RARITIES.common
            return (
              <button
                key={card.id}
                onClick={() => handleAddCard(card.id)}
                disabled={actionLoading || trade.myReady}
                className="bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded p-1.5 hover:border-[var(--cd-cyan)]/30 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                <div className="aspect-square bg-[var(--cd-edge)] rounded flex items-center justify-center mb-1 overflow-hidden">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-[8px] text-white/40 text-center px-0.5">{card.godName}</div>
                  )}
                </div>
                <div className="text-[9px] font-bold text-white truncate">{card.godName}</div>
                <div className="text-[8px] uppercase cd-head" style={{ color: rarityInfo.color }}>{card.rarity}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TradeCardSlot({ card, onRemove, disabled }) {
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common
  return (
    <div className="relative bg-[var(--cd-edge)] border border-[var(--cd-border)] rounded p-1.5 group">
      <div className="aspect-square rounded flex items-center justify-center overflow-hidden mb-1">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.godName} className="w-full h-full object-contain" />
        ) : (
          <div className="text-[8px] text-white/40 text-center">{card.godName}</div>
        )}
      </div>
      <div className="text-[9px] font-bold text-white truncate">{card.godName}</div>
      <div className="text-[8px] uppercase cd-head" style={{ color: rarityInfo.color }}>{card.rarity}</div>
      {onRemove && !disabled && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/CCTrading.jsx
git commit -m "feat(vault): add trading page with inbox, trade room, and history"
```

---

### Task 8: Manual Testing

- [ ] **Step 1: Start dev server**

```bash
npm start
```

- [ ] **Step 2: Run the migration on the dev database**

- [ ] **Step 3: Test the full flow**

1. Log in as User A, go to The Vault > Trade tab
2. Click "Start Trade", search for User B, create trade
3. Log in as User B (second browser/incognito), see pending invite
4. User B joins — both should see the trade room
5. User A adds cards, sets Core amount — verify User B sees updates within 3s
6. User B adds cards — verify User A sees updates
7. Both click Ready — verify Confirm button appears
8. User A modifies trade — verify both ready flags reset
9. Re-ready, both confirm — verify atomic swap completes
10. Check both collections updated, Core balances correct
11. Test cancel flow, test expiry (wait 2 min with no polling)
12. Test marketplace: try listing a card that's in an active trade — should fail

- [ ] **Step 4: Commit any fixes from testing**

---

### Task 9: Dynamic Column Fix

The `setCore` and `setReady` functions use dynamic column names. Neon's tagged template `sql()` doesn't support dynamic column identifiers the same way pg does. If this breaks during testing, replace the dynamic approach with conditional queries:

**Files:**
- Modify: `functions/lib/trading.js`

- [ ] **Step 1: Replace setCore with conditional approach if needed**

```js
export async function setCore(sql, userId, tradeId, amount) {
  if (amount < 0) throw new Error('Core amount cannot be negative')

  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId} AND status = 'active'`
  if (!trade) throw new Error('Trade not found or not active')
  if (trade.player_a_id !== userId && trade.player_b_id !== userId) throw new Error('You are not in this trade')

  const isA = trade.player_a_id === userId
  if (isA) {
    await sql`
      UPDATE cc_trades SET player_a_core = ${amount},
        player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
      WHERE id = ${tradeId}
    `
  } else {
    await sql`
      UPDATE cc_trades SET player_b_core = ${amount},
        player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
      WHERE id = ${tradeId}
    `
  }
}

export async function setReady(sql, userId, tradeId) {
  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId} AND status = 'active'`
  if (!trade) throw new Error('Trade not found or not active')
  if (trade.player_a_id !== userId && trade.player_b_id !== userId) throw new Error('You are not in this trade')

  if (trade.player_a_id === userId) {
    await sql`UPDATE cc_trades SET player_a_ready = true, updated_at = NOW() WHERE id = ${tradeId}`
  } else {
    await sql`UPDATE cc_trades SET player_b_ready = true, updated_at = NOW() WHERE id = ${tradeId}`
  }
}
```

Delete the `getPlayerCoreCol` and `getPlayerReadyCol` helpers.

- [ ] **Step 2: Commit if changes were needed**

```bash
git add functions/lib/trading.js
git commit -m "fix(vault): use conditional queries for dynamic trade columns"
```

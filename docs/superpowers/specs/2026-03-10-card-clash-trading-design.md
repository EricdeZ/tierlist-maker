# Card Clash: Direct Trading System

## Overview

Player-to-player card trading via a live trade room. Both players sit on the same trade screen, each adding/removing their own cards and Core, then ready up and confirm to execute an atomic swap. No fees on direct trades (marketplace remains the fee channel).

## Data Model

### `cc_trades`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| player_a_id | INT FK users | Trade initiator |
| player_b_id | INT FK users | Trade recipient |
| status | TEXT | `waiting`, `active`, `completed`, `cancelled`, `expired` |
| player_a_core | INT DEFAULT 0 | Core offered by A |
| player_b_core | INT DEFAULT 0 | Core offered by B |
| player_a_ready | BOOLEAN DEFAULT false | |
| player_b_ready | BOOLEAN DEFAULT false | |
| player_a_confirmed | BOOLEAN DEFAULT false | |
| player_b_confirmed | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Updated on every modification |
| last_polled_at | TIMESTAMPTZ | Updated on every poll (heartbeat for expiry detection) |
| completed_at | TIMESTAMPTZ | Set on completion |

Indexes:
- `(player_a_id, status)` and `(player_b_id, status)` for inbox queries
- Unique partial on `(player_a_id)` WHERE status IN (`waiting`, `active`) — max 1 active/waiting trade per user (as initiator)
- Unique partial on `(player_b_id)` WHERE status IN (`waiting`, `active`) — max 1 active/waiting trade per user (as recipient)
- Also check at create time that the target user has no active trade (as either player_a or player_b)

### `cc_trade_cards`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| trade_id | INT FK cc_trades | |
| card_id | INT FK cc_cards | |
| offered_by | INT FK users | Which player offered this card |

Unique constraint on `(trade_id, card_id)`.

## Trade Flow

1. **Initiate**: Player A searches for Player B by username, creates trade → status `waiting`
2. **Join**: Player B sees pending invite (via `pendingTradeCount` in CardClash load response), navigates to trade tab, joins → status `active`
3. **Build offers**: Both players on trade room page, polling every 3 seconds. Each adds/removes their own cards and sets Core amount. Any modification resets both `ready` flags to false.
4. **Ready up**: Player clicks Ready. If either player modifies anything after readying, both ready flags reset.
5. **Confirm**: Once both ready, Confirm button appears. Both must confirm. Second confirm triggers atomic swap.
6. **Complete**: Cards swap `owner_id`, Core transfers via `grantEmber()`, status → `completed`.
7. **Cancel**: Either player can cancel at any time → status `cancelled`, all locks released.
8. **Expire**: If `last_polled_at` older than 2 minutes, trade auto-expires. Checked on next poll AND during CardClash `load` action (cleans up abandoned trades even if neither player returns to the trade room).

## Card Locking

Cards in an active/waiting trade cannot be:
- Listed on the marketplace
- Added to another trade

Enforcement:
- `addCard` wrapped in a transaction: `SELECT ... FROM cc_cards WHERE id = $cardId FOR UPDATE`, then check no row exists in `cc_trade_cards` for an active/waiting trade, then INSERT
- Marketplace `createListing` in `functions/lib/marketplace.js` must be updated to also check that the card is not in an active/waiting trade before allowing listing
- Database-level: unique index on `cc_trade_cards(card_id)` isn't possible with partial trade status, so enforcement is via SELECT FOR UPDATE + application-level check inside transactions

## Currency

- Core only (no Passion in trades)
- No fees on direct trades
- Core transfers use existing `grantEmber()` with type `cc_trade` for audit trail
- Validate both players can afford their offered Core before executing

## API Endpoint

Single endpoint: `functions/api/trading.js`, action-based routing matching marketplace pattern.

### GET actions

| Action | Params | Returns |
|--------|--------|---------|
| `pending` | — | Pending trade invites for current user |
| `poll` | `tradeId` | Full trade state + updates `last_polled_at` (heartbeat). Despite being GET, updates timestamp for expiry tracking. |
| `history` | — | Recent completed/cancelled trades |
| `search-users` | `q` | Users matching search term (for initiating trades) |

### POST actions

| Action | Body | Effect |
|--------|------|--------|
| `create` | `{ targetUserId }` | Create trade, status `waiting` |
| `join` | `{ tradeId }` | Join trade, status → `active` |
| `add-card` | `{ tradeId, cardId }` | Add own card, reset ready flags |
| `remove-card` | `{ tradeId, cardId }` | Remove own card, reset ready flags |
| `set-core` | `{ tradeId, amount }` | Set Core offer, reset ready flags |
| `ready` | `{ tradeId }` | Set ready to true (idempotent; resets happen on modifications) |
| `confirm` | `{ tradeId }` | Confirm trade, execute if both confirmed |
| `cancel` | `{ tradeId }` | Cancel trade |

## Library: `functions/lib/trading.js`

Core logic separated from endpoint routing:
- `createTrade(sql, userId, targetUserId)` — validates no existing active trade between pair, creates trade
- `joinTrade(sql, userId, tradeId)` — validates user is player_b, status is waiting
- `addCard(sql, userId, tradeId, cardId)` — validates ownership, not locked, resets ready
- `removeCard(sql, userId, tradeId, cardId)` — validates card is in trade, offered by user
- `setCore(sql, userId, tradeId, amount)` — validates amount >= 0, resets ready
- `setReady(sql, userId, tradeId)` — set ready to true (idempotent; unready only happens via modification resets)
- `confirmTrade(tx, userId, tradeId)` — if both confirmed, execute swap in transaction
- `cancelTrade(sql, userId, tradeId)` — set status cancelled
- `checkExpiry(sql, tradeId)` — if `updated_at` older than 2 min, auto-expire

`confirmTrade` uses `FOR UPDATE` lock on the trade row + all trade cards to prevent races.

## Swap Execution (inside transaction)

1. Lock trade row `FOR UPDATE`
2. Verify both confirmed, status still `active`
3. Verify both players still own their offered cards
4. Lock `ember_balances` rows FOR UPDATE for both players, verify both can afford their Core offers
5. Transfer cards: `UPDATE cc_cards SET owner_id = ... WHERE id IN (...)`
6. Transfer Core (if any non-zero amounts):
   - `grantEmber(tx, playerA, 'cc_trade', -player_a_core, 'Trade: sent Core', tradeId)`
   - `grantEmber(tx, playerB, 'cc_trade', player_a_core, 'Trade: received Core', tradeId)`
   - `grantEmber(tx, playerB, 'cc_trade', -player_b_core, 'Trade: sent Core', tradeId)`
   - `grantEmber(tx, playerA, 'cc_trade', player_b_core, 'Trade: received Core', tradeId)`
   - Skip zero-amount calls
7. Validate at least one card or non-zero Core is being exchanged total
8. Set status `completed`, `completed_at = NOW()`

## Frontend

### Service Layer

Add `tradingService` to `src/services/database.js`:
```js
export const tradingService = {
  pending: () => apiCall('trading', { action: 'pending' }),
  poll: (tradeId) => apiCall('trading', { action: 'poll', tradeId }),
  history: () => apiCall('trading', { action: 'history' }),
  searchUsers: (q) => apiCall('trading', { action: 'search-users', q }),
  create: (targetUserId) => apiPost('trading', { action: 'create' }, { targetUserId }),
  join: (tradeId) => apiPost('trading', { action: 'join' }, { tradeId }),
  addCard: (tradeId, cardId) => apiPost('trading', { action: 'add-card' }, { tradeId, cardId }),
  removeCard: (tradeId, cardId) => apiPost('trading', { action: 'remove-card' }, { tradeId, cardId }),
  setCore: (tradeId, amount) => apiPost('trading', { action: 'set-core' }, { tradeId, amount }),
  ready: (tradeId) => apiPost('trading', { action: 'ready' }, { tradeId }),
  confirm: (tradeId) => apiPost('trading', { action: 'confirm' }, { tradeId }),
  cancel: (tradeId) => apiPost('trading', { action: 'cancel' }, { tradeId }),
}
```

### Pages

**`CCTrading.jsx`** — Trade tab with sub-views:
- **Inbox view** (default): Pending invites + "Start Trade" button (user search modal)
- **Trade room view**: Active trade interface (when in a trade)
- **History view**: Recent completed/cancelled trades

**Trade Room Layout:**
```
┌─────────────────────────────────────────────────┐
│  Trading with: PlayerB          [Cancel Trade]  │
├──────────────────────┬──────────────────────────┤
│   YOUR OFFER         │   THEIR OFFER            │
│                      │                          │
│  [Card] [Card]       │  [Card] [Card]           │
│  [Card]              │                          │
│                      │                          │
│  + 200 Core          │  + 0 Core                │
│                      │                          │
│  [Set Core] [Ready]  │  Status: Not Ready       │
├──────────────────────┴──────────────────────────┤
│   YOUR COLLECTION (scrollable, click to add)    │
│  [Card] [Card] [Card] [Card] [Card] [Card] ... │
└─────────────────────────────────────────────────┘
```

- Cards in trade shown with visual distinction from collection
- Locked cards (in other trades/marketplace) shown grayed out
- Ready status shown per player (green check / waiting)
- When both ready: Confirm button appears with final summary
- Poll every 3 seconds updates the right side + ready/confirm state

### CardClash Integration

- Add `pendingTradeCount` to the `load` response in `cardclash.js`
- Show badge on Trade tab in `CardClashPage.jsx` when count > 0
- Add `'trade'` to `TABS` array with `Handshake` icon (distinct from Convert's `ArrowRightLeft`)
- Cards in active trades shown with lock icon in collection views

## Constraints

- Max 1 active/waiting trade per user at a time (simplifies locking + UI)
- Max 10 cards per side per trade
- Core amount must be >= 0, validated against balance at confirm time (not at set time)
- Trade auto-expires after 2 minutes of no polls (via `last_polled_at`); cleanup also runs on CardClash `load`
- Cannot trade with yourself
- At least one card or non-zero Core must be exchanged total (no empty trades)

## Cross-Cutting Changes

- `functions/lib/marketplace.js` `createListing`: add check that card is not in active/waiting trade
- `functions/api/cardclash.js` `handleLoad`: add `pendingTradeCount` to response + expire stale trades
- `src/pages/cardclash/CardClashContext.jsx`: store `pendingTradeCount` in context state

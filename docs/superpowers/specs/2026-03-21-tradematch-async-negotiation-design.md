# TradeMatch Async Negotiation Design

## Problem

Clicking "Trade" on an active TradeMatch match redirects to `/vault?tab=trade&tradeId=X`, causing a full page reload and dropping into the synchronous Trade Room designed for direct trades. This doesn't work for TradeMatch's use case — matches are asynchronous and users aren't necessarily online at the same time.

## Solution

Build an async offer-based negotiation system that lives entirely within TradeMatch. The synchronous Trade Room remains unchanged for direct trades.

## Data Model

### Schema Changes (migration)

Add columns to `cc_trades` (for `mode = 'match'` trades only):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `offer_by` | bigint FK → users | NULL | Who last submitted the offer |
| `offer_status` | text | `'negotiating'` | `negotiating` / `pending` / `accepted` |
| `offer_version` | int | 0 | Bumped each send, used for optimistic concurrency |

Existing columns already used:
- `player_a_core` / `player_b_core` — Cores offered by each side
- `cc_trade_cards` with `offered_by` — cards in the offer per side
- `status` — overall trade lifecycle (active/completed/cancelled/expired)

### Concurrency

`offer_version` prevents race conditions. Accept/send operations include the version the client saw; backend rejects if it has changed.

### Card Locking

Cards are NOT locked during match negotiations. Availability is checked:
1. On `offer-detail` fetch — flags unavailable cards visually
2. On `offer-accept` — hard validation, rejects if any card is gone

### Caps

Raise concurrent match trade limit from 5 to 15 per user.

## API Changes

All within `functions/api/tradematch.js` and `functions/lib/tradematch.js`.

### New GET Actions

| Action | Params | Returns |
|--------|--------|---------|
| `offer-detail` | `tradeId` | Full offer state: both sides' cards (with holo type, rarity, image, name), Cores, offer_status, offer_by, version, card availability flags |

### New POST Actions

| Action | Payload | Behavior |
|--------|---------|----------|
| `offer-add-card` | `tradeId, cardId` | Add card to offer (your card to your side, their trade pile card to their side) |
| `offer-remove-card` | `tradeId, cardId` | Remove card from offer |
| `offer-set-core` | `tradeId, amount` | Set your Cores amount |
| `offer-send` | `tradeId` | Submit offer: set `offer_by` = you, `offer_status` = `pending`, bump `offer_version`. Must have at least 1 card or Cores on your side. |
| `offer-accept` | `tradeId, version` | Accept pending offer. Validates card availability, executes card swap + Cores transfer, sets `status = 'completed'`. Rejects if version mismatch. |
| `offer-cancel` | `tradeId` | Cancel negotiation, sets `status = 'cancelled'` |

### Enhanced Existing Actions

- `matches` GET: Returns `offer_by`, `offer_status`, `offer_version` so the matches list shows whose turn it is.

## Frontend

### New Component: `tradematch/Negotiation.jsx`

Rendered inside `CCTradematch` when a match trade is opened (replaces the redirect to Trade Room).

**Layout (two-column, mobile-stacked):**

```
+-----------------------------------------+
|  <- Back to Matches                     |
+-------------------+---------------------+
|   YOUR OFFER      |   YOU WANT          |
| [card] [card] [+] | [card] [+]          |
|                   |                     |
| Cores: [___]      | Cores: 50           |
+-------------------+---------------------+
|      [ Send Offer ]  [ Cancel ]         |
|  -- or if pending from other side --    |
|   [ Accept ]  [ Counter ]  [ Cancel ]   |
+-----------------------------------------+
```

**Card rendering:** All cards render with holo overlay (reverse, full, reverse-full) matching the vault's existing CardImage component. Unavailable cards get a red "Unavailable" overlay.

**"+ Add card" dashed slot:** Opens a picker showing the relevant trade pile. Your side shows your trade pile; "You Want" side shows their trade pile. Cards already in the offer are dimmed.

### States

| State | UI |
|-------|-----|
| `negotiating`, not yet sent | Both sides editable, "Send Offer" button |
| `pending`, `offer_by` = you | Read-only, "Waiting for response..." |
| `pending`, `offer_by` = them | See their offer, "Accept" / "Counter" / "Cancel" buttons |
| Card unavailable | Red overlay on card, "Send Offer" disabled until removed |
| Trade expired | "This trade has expired" message |

### Counter Flow

Clicking "Counter" sets `offer_status` back to `negotiating` locally and allows editing. User modifies cards/Cores, then hits "Send Offer" to submit the counter.

### Refetch Strategy (no websockets)

- `visibilitychange` event: refetch matches list + current offer detail when tab regains focus
- Refetch when navigating to matches sub-view
- Toast notification if a match trade's `offer_status` changed since last fetch

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Card traded/sold elsewhere | Flagged unavailable on next fetch. Must remove before sending. Accept rejects if stale. |
| Simultaneous sends | `offer_version` check — second send fails, user refetches |
| Accept with stale version | Backend rejects, UI refetches current state |
| 24h expiry during negotiation | `expireStale()` marks expired. UI shows expiry message. |
| User at 15 concurrent cap | Match creation blocked with cap message |
| All cards removed from offer | "Send Offer" disabled — must have at least 1 card or Cores |
| Match pre-seeded cards | Both matched cards auto-inserted on match creation (existing behavior) |

## Files to Change

### Backend
- `database/migrations/133-match-negotiation.sql` — new columns
- `functions/lib/tradematch.js` — negotiation business logic
- `functions/api/tradematch.js` — new API actions

### Frontend
- `src/pages/vault/tradematch/Negotiation.jsx` — new negotiation UI
- `src/pages/vault/tradematch/CardPicker.jsx` — trade pile picker modal
- `src/pages/vault/CCTradematch.jsx` — route to Negotiation instead of redirect, add visibility refetch
- `src/pages/vault/tradematch/MatchesAndLikes.jsx` — show offer status on match cards
- `src/services/database.js` — new tradematchService methods

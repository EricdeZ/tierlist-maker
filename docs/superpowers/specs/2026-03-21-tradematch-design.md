# Tradematch — Tinder-Style Card Trading Matchmaker

## Overview

Tradematch is a discovery layer for card trading. Users mark cards for trade, swipe through other people's trade piles Tinder-style, and get matched when mutual interest exists. Matches create async trades that last 24 hours.

Full romance theme — premium swipe physics, "It's a Match!" splash, hearts, playful copy. The swipe UI must feel polished and weighty like real Tinder, not cheap or janky.

## Core Flow

1. User marks at least 20 cards for their trade pile
2. User enters the swiper — sees one card at a time from other users' trade piles
3. Swipe left (skip, no record) or right (want, stored in `cc_swipes`)
4. On right-swipe, server checks: does the card owner have a right-swipe on any of the swiper's trade-pile cards?
5. If yes → match. Creates an async trade (`cc_trades` with `mode='match'`) with the two matched cards pre-loaded
6. If no → swipe recorded silently, card owner's cards get boosted in the swiper's feed next time
7. Users negotiate in an async trade room (add/remove cards, add Core, confirm) with 24h expiry

## Data Model

### New Table: `cc_trade_pile`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | integer FK users(id) | NOT NULL |
| card_id | integer FK cc_cards(id) | NOT NULL |
| created_at | timestamptz | default now() |

- Unique on `(user_id, card_id)`
- Index on `(card_id)` for match detection queries
- Validation on insert: card must be owned by user, not in Starting 5, binder, marketplace, or active direct trade
- Cards in match-mode trades are NOT blocked from the trade pile (no locking for match trades)
- **Auto-removal:** When a card gets slotted into Starting 5, binder, or marketplace, it is automatically removed from `cc_trade_pile`. This prevents stale trade-pile cards from appearing in the swipe feed that would immediately fail on match.
- FK on `card_id` should be `ON DELETE CASCADE` so trade pile entries are cleaned up when cards are deleted/dismantled

### New Table: `cc_swipes`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| swiper_id | integer FK users(id) | NOT NULL, who swiped right |
| card_id | integer FK cc_cards(id) | NOT NULL, card they want |
| card_owner_id | integer FK users(id) | NOT NULL, denormalized for fast "likes" queries |
| created_at | timestamptz | default now() |

- Only right-swipes stored. Left-swipes are discarded.
- Unique on `(swiper_id, card_id)` — can't swipe right on the same card twice
- Index on `card_owner_id` for "who liked my cards" list
- Index on `swiper_id` for filtering already-swiped cards from feed
- FK on `card_id` should be `ON DELETE CASCADE` so swipe records are cleaned up when cards are deleted

### Changes to `cc_trades`

- Add column `mode TEXT NOT NULL DEFAULT 'direct'` — values: `'direct'` or `'match'`
- Add columns `match_swipe_a_id`, `match_swipe_b_id`: integer FK to `cc_swipes(id)`, nullable
  - `match_swipe_a_id`: the swipe that triggered the match (the swiper's right-swipe)
  - `match_swipe_b_id`: the pre-existing swipe from the card owner on the swiper's trade pile
  - For likes-initiated trades: `match_swipe_b_id` is the like (the other user's swipe on your card), `match_swipe_a_id` is NULL
- Match-mode trades: 24h expiry from `created_at`, checked on poll
- Existing "one active trade" constraint applies only to `mode='direct'`
- Match-mode trades have a separate 5-outgoing cap (per user, counted by `player_a_id` where mode='match')
- Add unique partial index to prevent duplicate active matches between the same pair:
  ```sql
  CREATE UNIQUE INDEX idx_cc_trades_match_pair_active
      ON cc_trades (LEAST(player_a_id, player_b_id), GREATEST(player_a_id, player_b_id))
      WHERE mode = 'match' AND status = 'active';
  ```

### Card Locking Semantics

Match-mode trades do NOT lock cards. This means:

- `isCardInTrade()` checks must only count `mode='direct'` trades as locks
- A card can be in a match-trade AND a direct trade simultaneously (the match-trade will auto-cancel on conflict)
- A card can be in multiple match-trades simultaneously
- A card in a match-trade CAN be added to Starting 5, binder, marketplace — doing so auto-cancels the match-trade on next poll
- All existing lock checks (marketplace listing, Starting 5 slotting, binder slotting, bounty fulfillment) only consider `mode='direct'` trades as blocking

### Challenge Compatibility

Match-mode trade completions DO count toward `trades_completed` challenge stats. No filtering needed in challenge queries.

## Migration & Existing Code Impact

The `mode` column addition requires updates to every query that touches `cc_trades` without mode awareness:

### `functions/lib/trading.js`
- **`expireStale()`** — Add `AND mode = 'direct'` to the 2-minute expiry. Add separate clause: `OR (mode = 'match' AND created_at < NOW() - interval '24 hours')` for match expiry
- **`createTrade()`** — Add `AND mode = 'direct'` to the existing active-trade check so match-trades don't block direct trade creation
- **`isCardInTrade()`** — Add `AND t.mode = 'direct'` so match-trade cards aren't considered locked
- **`isPackInTrade()`** — Add `AND t.mode = 'direct'` (same pattern as isCardInTrade)
- **`addCard()` (~line 119)** — Has its own inline trade-lock query (does NOT call `isCardInTrade`). Add `AND t.mode = 'direct'` to the inline query so cards in match-trades aren't blocked from being added
- **`addPack()` (~line 198)** — Has its own inline trade-lock query (does NOT call `isPackInTrade`). Add `AND t.mode = 'direct'` to the inline query

### `functions/api/trading.js`
- **`handlePending()`** — Add `AND mode = 'direct'` filter so match-trades don't appear in the direct trade inbox
- **`handleHistory()`** — Add `mode` to the response so the frontend can distinguish trade types in history

### `functions/api/vault.js`
- **Inline expiry query (~line 214)** — Replace with mode-aware expiry:
  ```sql
  UPDATE cc_trades SET status = 'expired', updated_at = NOW()
  WHERE (status IN ('waiting', 'active') AND mode = 'direct'
         AND last_polled_at < NOW() - make_interval(mins => 2))
     OR (status = 'active' AND mode = 'match'
         AND created_at < NOW() - interval '24 hours')
  ```
- **Trade count query (~line 202)** — Filter to `mode = 'direct'` for the direct trade badge count (Tradematch has its own match count)
- **Locked cards/packs queries (~line 224)** — Add `AND t.mode = 'direct'` so match-trade cards aren't greyed out in collection
- **`handleBinderSlot()` (~line 2392)** — Has inline trade-lock query. Add `AND t.mode = 'direct'`

### Database migration
- **Drop and recreate unique indexes from 084-trading.sql:**
  ```sql
  DROP INDEX idx_cc_trades_player_a_active;
  DROP INDEX idx_cc_trades_player_b_active;
  CREATE UNIQUE INDEX idx_cc_trades_player_a_active
      ON cc_trades(player_a_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';
  CREATE UNIQUE INDEX idx_cc_trades_player_b_active
      ON cc_trades(player_b_id) WHERE status IN ('waiting', 'active') AND mode = 'direct';
  ```

### Other files (all have inline trade-lock queries, NOT shared helpers)
- **`functions/lib/starting-five.js` (~line 523)** — Inline trade-lock query. Add `AND t.mode = 'direct'`
- **`functions/lib/bounty.js` (~line 98)** — Inline trade-lock query. Add `AND t.mode = 'direct'`
- **`functions/lib/marketplace.js` (~line 98)** — Uses `isPackInTrade()` helper for packs; has inline check for cards. Both need `mode = 'direct'` filter

**Important:** Most lock-check sites use inline queries, not the shared `isCardInTrade()`/`isPackInTrade()` helpers. Each site listed above must be individually updated.

## Swipe Feed

**Query:** All cards in `cc_trade_pile` from other users, excluding:
- Your own cards
- Cards you've already swiped right on (join against `cc_swipes`)
- Cards from users you're already in an active match-trade with

**Smart sort (descending priority):**
1. **Swipe boost** — someone swiped right on one of YOUR trade-pile cards → their cards appear first
2. **Novelty** — cards with `god_id` + rarity combos you don't own ranked higher
3. **Recency** — newer trade pile listings before stale ones
4. **Random salt** — tiebreaker to keep feed feeling fresh

Paginated: ~50 cards per batch. No feed position caching — reshuffles on re-entry.

## Match Detection

Happens synchronously at swipe time:

1. Check swiper has < 5 outgoing match-trades, else reject
2. Insert right-swipe into `cc_swipes`
3. Query: does `card_owner_id` have any swipe in `cc_swipes` on a card in the swiper's `cc_trade_pile`?
4. If yes → check no active match-trade already exists between these two users (unique index covers this)
5. Create `cc_trades` row with `mode='match'`, status `'active'`, swiper as `player_a`, card owner as `player_b`
6. Insert both matched cards into `cc_trade_cards`
7. Store both swipe IDs as `match_swipe_a_id` (swiper's swipe) and `match_swipe_b_id` (card owner's pre-existing swipe)
8. Return match result to frontend for the "It's a Match!" screen

## Async Trade Room

Reuses existing trade infrastructure with behavioral differences for `mode='match'`:

- **No real-time sync required** — users poll on open, modify at their own pace
- **24h expiry** — `created_at + 24h < now()` checked on poll, auto-expires
- **No card locking** — cards are NOT locked while in a match-trade
- **Auto-cancel on conflict** — if any card in the trade has been traded away, put in Starting 5, binder, marketplace, or deleted since being added, the trade auto-cancels on next poll. Checked by verifying card ownership + availability at poll/confirm time.
- **Same operations** — add/remove card, add/remove pack, set Core (0-10,000), confirm, cancel
- **Both confirm to execute** — same two-step ready + confirm flow
- Existing `/api/trading` endpoint handles all trade room interactions; `mode` column drives behavioral branching

## Likes List

- Endpoint returns all right-swipes on your trade-pile cards, grouped by user
- Filters out stale likes: only shows swipes where the card is still in your trade pile and still owned by you
- Shows which of your cards each person liked, with their username
- "Start Trade" button creates an async match-trade directly (bypasses swipe matching)
- This lets you proactively initiate trades with people who want your cards

**Likes-trade validation:**
- Checks the 5-outgoing cap for the user initiating from the likes list
- Checks no active match-trade already exists between the two users
- Verifies at least one liked card is still in the trade pile
- Creates trade with initiator as `player_a_id` (counts toward their 5-outgoing cap), liker as `player_b_id`
- Sets `match_swipe_b_id` to the like's swipe ID, `match_swipe_a_id` NULL
- Pre-loads the liked card into `cc_trade_cards` on the initiator's side (they're offering the card that was liked)

## Outgoing Match Cap

- Users can have max 5 outgoing match-trades (trades where their swipe initiated the match, counted as `player_a_id = userId AND mode = 'match' AND status = 'active'`)
- At 5 outgoing, the swiper is locked: "Your heart is full — handle your matches first"
- Incoming matches (from other people's swipes) can still create trades beyond the cap
- Likes-initiated trades also count toward the initiator's 5-outgoing cap
- This cap is separate from the existing 1-active-trade limit for direct trades

## API Design

### New endpoint: `/api/tradematch`

| Action | Method | Description |
|--------|--------|-------------|
| `trade-pile` | GET | Get user's trade pile cards |
| `trade-pile-add` | POST | Mark a card for trade |
| `trade-pile-remove` | POST | Unmark a card from trade |
| `swipe-feed` | GET | Next batch of swipeable cards (paginated) |
| `swipe` | POST | Record right-swipe, check for match |
| `likes` | GET | Users who swiped right on your cards |
| `likes-trade` | POST | Initiate async trade from a like |
| `matches` | GET | Active match-trades list |

Trade room interactions (add-card, remove-card, set-core, confirm, cancel, poll) go through existing `/api/trading` endpoint — works for both direct and match-mode trades.

All endpoints require auth (`requireAuth`). No special RBAC permissions needed — any authenticated user can use Tradematch.

## Frontend

### Location

New "Tradematch" tab/section in the Vault.

### Three Sub-Views

**1. Trade Pile Manager**
- Grid of your collection with toggle to mark/unmark for trade
- Counter: "X/20 cards marked" with progress indicator
- Quick filters: rarity, type, holo
- Swiper stays locked until 20 cards marked

**2. The Swiper**
- Full-screen single card, one at a time
- Premium swipe UX: spring physics on drag, shadow + rotation on pull, snap-back if uncommitted, velocity-based throw animation
- Card display: full card art, name, rarity, holo type (color-coded badge), owner username
- Left swipe: card flies off left, next slides in
- Right swipe: card flies off right, server call, next slides in
- On match: full-screen "It's a Match!" splash — hearts, sparkles, two matched cards side by side, cheesy tagline ("You and @username have a connection..."), buttons to open trade room or keep swiping
- At 5 matches: swiper locked with romantic message
- Re-checks 20-card minimum on each swipe response; locks if trade pile drops below 20

**3. Matches & Likes**
- Active matches: list with status indicators (waiting for you / waiting for them / both confirmed)
- Likes: grouped by user, shows which cards they liked, "Start Trade" button
- Tap match → opens async trade room (reuses existing trade room UI)

### Romance Theme
- Pink/red accent colors in Tradematch section
- Heart icons throughout
- "It's a Match!" animation with sparkles
- Playful copy ("Swipe right if your heart desires...", "This one got away" on expiry, "Your heart is full" at cap)
- Premium, polished feel — not ironic or cheap

## Edge Cases

- **Card removed from trade pile while in swipe feed:** Next swipe on it returns a "card unavailable" response, frontend skips to next card
- **Card traded/deleted while in match-trade:** Trade auto-cancels on next poll (ownership + availability check)
- **User drops below 20 trade pile cards:** Swiper locks, existing matches stay active. Re-checked on each swipe response.
- **Both users swipe on each other simultaneously:** Unique partial index on `cc_trades` prevents duplicate active matches between the same pair
- **Swipe on card from user already in match-trade with you:** Card excluded from feed by query filter
- **Stale swipes after card ownership changes:** Likes list filters out swipes where card is no longer in trade pile or ownership has changed. Swipe records stay in DB (harmless) but don't surface in queries.
- **Card in multiple match-trades confirmed simultaneously:** The `handleConfirm` transaction checks ownership at execution time. Second confirmation fails if card was already transferred.

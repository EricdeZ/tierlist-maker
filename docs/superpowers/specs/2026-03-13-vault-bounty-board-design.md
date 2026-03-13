# Vault Bounty Board — Design Spec

## Overview

A wild-west-themed bounty board within the Vault where users post wanted requests for specific cards, offering Core currency as a reward. Other users who own matching cards can instantly turn them in for the bounty reward. The board uses a cyber-western fusion aesthetic — dark vault panels with orange neon glow, western serif typography, and taped mugshot-style card portraits.

## Mechanics

### Posting a Bounty
- User selects exact card spec via form: **card type** (god/player/item/consumable) → **name** (god name, player name, etc.) → **rarity** → **holo type** (optional)
- User sets a **Core reward amount** (minimum 1, maximum 10,000 — matches marketplace cap)
- Cores are **escrowed** on creation — debited from the poster's balance immediately
- Maximum **3 active bounties** per user

### Fulfilling a Bounty
- Any user who owns a card matching the exact spec can turn it in
- **Instant fulfillment** — first person to claim wins, no approval step
- Card transfers to the bounty poster, escrowed Cores transfer to the fulfiller
- The fulfiller's card must pass the same lock checks as marketplace (not in active trade, Starting 5, or binder)

### Cancellation & Expiry
- Bounties **expire after 14 days** — escrowed Cores return minus **10% fee** (`Math.max(Math.floor(reward * 0.10), 1)`)
- Manual cancellation allowed — escrowed Cores return minus **25% fee** (`Math.max(Math.floor(reward * 0.25), 1)`)
- Minimum fee is always 1 Core (consistent with marketplace min fee)
- Fees are destroyed (removed from circulation) — only the refund is recorded as a transaction, not the fee separately

### Privacy
- **Anonymous posters** — bounty board shows only the card spec and reward, not who posted it
- "My Bounties" filter lets the poster see and manage their own

## Visual Design

### Theme: Cyber-Western Fusion
- Dark vault panels (`--cd-surface`, `--cd-edge` backgrounds) with the vault's grid pattern
- **Orange neon accents** (`#ff8c00`) instead of cyan for bounty-specific elements — glow effects, borders, pin highlights
- **Western serif typography** (Georgia) for "WANTED" headers and reward amounts
- Vault monospace (`Share Tech Mono`) for metadata labels

### Wanted Poster Design
Each bounty renders as a wanted poster with:
1. **Neon pin** — Orange glowing dot at top center
2. **"WANTED" header** — Georgia serif, orange, wide letter-spacing, neon text-shadow
3. **Taped mugshot** — Card artwork (god portrait / player avatar / item image) cropped as a rectangular headshot with:
   - Visible tape strips at top corners (translucent warm overlay)
   - Slight desaturation + contrast bump (`filter: contrast(1.1) saturate(0.8)`)
   - Dark vignette overlay
   - Hard border (`#1a150e`)
4. **Card name** — Bold, white
5. **Rarity badge** — Pill with rarity color border + tinted background (matches existing rarity color system from `RARITIES`)
6. **Holo type** — Small text if applicable (e.g., "Holo · God Card")
7. **Reward section** — Divider line, "REWARD" label in monospace, large orange Core amount with glow

Poster container: dark semi-transparent background (`rgba(20, 15, 8, 0.92)`), orange border at low opacity, subtle inner glow, slight random rotation for pinboard feel.

### Page Layout

#### Hero Pinboard (Top)
- Top **5 highest-reward** active bounties displayed in scattered/angled arrangement
- Posters at slight random rotations (-2° to +2°), staggered positioning
- Larger poster size than the grid below
- Section header: "MOST WANTED" in western serif with orange glow

#### Filter Bar
Standard vault filter bar pattern (matches marketplace/collection):
- **Quick filters**: "Bounties I Can Turn In" (matches user's collection), "My Bounties" (user's posted bounties)
- **Card type**: god, player, item, consumable
- **Rarity**: common through mythic (colored pills)
- **Holo type**: holo, reverse, full
- **Price range**: Core min/max
- **Sort**: Highest reward, Lowest reward, Newest, Expiring soon

#### Bounty Grid (Below)
- Clean responsive grid of wanted posters (flex-wrap, `gap-4`)
- Smaller poster size than hero section
- Pagination (same pattern as marketplace)
- "Turn In" button on posters where user owns a matching card (highlighted in cyan)
- "No bounties found" empty state

#### Post a Bounty (Modal or Inline)
- Form with dropdowns: Card Type → Name (searchable) → Rarity → Holo Type (optional)
- Core price input with balance display
- Preview of the wanted poster as user fills in fields
- "Post Bounty" button — confirms escrow deduction
- Disabled / hidden if user has 3 active bounties

## Data Model

### New Table: `cc_bounties`

```sql
CREATE TABLE cc_bounties (
    id              SERIAL PRIMARY KEY,
    poster_id       INTEGER NOT NULL REFERENCES users(id),
    card_type       VARCHAR(20) NOT NULL,        -- god, player, item, consumable
    card_name       VARCHAR(200) NOT NULL,        -- matches cc_cards.god_name (all card types use god_name)
    rarity          VARCHAR(20) NOT NULL,         -- common..mythic
    holo_type       VARCHAR(20),                  -- holo, reverse, full, or NULL
    core_reward     INTEGER NOT NULL,             -- escrowed Core amount
    status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, completed, cancelled, expired
    fulfilled_by    INTEGER REFERENCES users(id), -- user who turned in the card
    fulfilled_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,         -- created_at + 14 days
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_bounties_status ON cc_bounties(status);
CREATE INDEX idx_bounties_poster ON cc_bounties(poster_id);
CREATE INDEX idx_bounties_expires ON cc_bounties(expires_at) WHERE status = 'active';
CREATE INDEX idx_bounties_card_spec ON cc_bounties(card_type, card_name, rarity) WHERE status = 'active';
```

### Player Card Matching
Player card bounties match by **name only** (not team/season/league). A bounty for "JohnDoe · Rare" accepts any rare JohnDoe player card regardless of which team or season. This maximizes fulfillment likelihood and keeps the creation form simple.

### Fulfillment Matching SQL
```sql
-- Find matching cards for a bounty
SELECT c.id FROM cc_cards c
WHERE c.owner_id = $fulfiller_id
  AND c.card_type = b.card_type
  AND c.god_name = b.card_name
  AND c.rarity = b.rarity
  AND (b.holo_type IS NULL OR c.holo_type = b.holo_type)
  -- Lock checks: not in trade, lineup, or binder
  AND NOT EXISTS (SELECT 1 FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id WHERE tc.card_id = c.id AND t.status IN ('waiting','active'))
  AND NOT EXISTS (SELECT 1 FROM cc_lineups l WHERE l.card_id = c.id OR l.god_card_id = c.id OR l.item_card_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM cc_binder_cards bc WHERE bc.card_id = c.id)
  -- Not already listed on marketplace
  AND NOT EXISTS (SELECT 1 FROM cc_market_listings ml WHERE ml.card_id = c.id AND ml.status = 'active')
LIMIT 1
```

### Ember Transactions
Reuses existing `ember_transactions` table with new types:
- `bounty_escrow` — negative, when bounty is posted
- `bounty_reward` — positive, when fulfiller turns in card
- `bounty_refund` — positive, when bounty expires or is cancelled (net of fee)

## API Design

### Endpoint: `functions/api/bounty.js`

All actions require authentication.

#### GET Actions
- **`list`** — Browse active bounties with filters (card_type, rarity, holo_type, sort, page). Returns bounty data without poster identity.
- **`my-bounties`** — User's own bounties (active + recent completed/cancelled/expired)
- **`fulfillable`** — Active bounties that match cards in the user's collection (server-side join between `cc_bounties` and `cc_cards` where `owner_id = userId`)
- **`hero`** — Top 5 active bounties by `core_reward` DESC (for pinboard section)

#### POST Actions
- **`create`** — Post a new bounty. Within a transaction: lock ember balance row with `SELECT ... FOR UPDATE`, validate max 3 active, validate Core balance >= reward, validate card spec exists. Escrow via `grantEmber(tx, userId, 'bounty_escrow', -amount)`. Sets `expires_at = NOW() + INTERVAL '14 days'`.
- **`fulfill`** — Turn in a card for a bounty. Validates: bounty is active, card matches spec exactly, user owns card, card not locked. Atomic transaction: transfer card ownership to poster, credit fulfiller via `grantEmber(tx, fulfillerId, 'bounty_reward', amount)`, mark bounty completed.
- **`cancel`** — Cancel own bounty. Refunds 75% of escrowed Cores. Marks status `cancelled`.

### Expiry Processing
- **Lazy expiry on read**: When any bounty endpoint is hit, atomically expire stale bounties:
  ```sql
  -- Atomic claim: only one request can expire each bounty
  UPDATE cc_bounties SET status = 'expired', cancelled_at = NOW(), updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW()
  RETURNING *
  ```
- For each returned row, refund 90% of `core_reward` to `poster_id` via `grantEmber(tx, posterId, 'bounty_refund', refundAmount)`
- Run within a transaction to prevent double-refunding from concurrent requests
- Optional: `waitUntil` background task on vault load for proactive cleanup

### Card Spec Validation
- God cards: validate `card_name` exists in god data (`vault-data.js`)
- Player cards: validate player name exists in `cc_player_defs`
- Item cards: validate item name exists in item data
- Consumable cards: validate consumable name exists in consumable data

## Frontend Components

### New Files
- **`src/pages/vault/CCBountyBoard.jsx`** — Orchestrator with state management (~200 lines)
- **`src/pages/vault/bounty/HeroPinboard.jsx`** — Scattered top-5 hero section (~80 lines)
- **`src/pages/vault/bounty/BountyGrid.jsx`** — Filtered grid + pagination (~100 lines)
- **`src/pages/vault/bounty/CreateBountyForm.jsx`** — Creation modal with form + poster preview (~150 lines)
- **`src/pages/vault/components/WantedPoster.jsx`** — Individual bounty poster component (~150 lines)
  - Props: bounty data, size, canFulfill flag
  - Renders the taped-photo western poster design
- **`src/services/api/bounty.ts`** — API service functions (list, create, fulfill, cancel, hero, fulfillable, myBounties)

### Modified Files
- **`src/pages/VaultPage.jsx`** — Add bounty tab to TABS array and TAB_COMPONENTS
- **`src/pages/vault/VaultContext.jsx`** — Add active bounty count to vault state (for tab badge showing "3/3" or similar)
- **`src/services/database.js`** — Re-export bounty service

### Tab Integration
```javascript
// In TABS array
{ key: 'bounty', label: 'Bounties', icon: Crosshair }  // or Target icon from lucide

// In TAB_COMPONENTS
bounty: CCBountyBoard
```

### "Bounties I Can Turn In" Filter
Server-side via the `fulfillable` endpoint — returns bounty IDs that the user has unlocked matching cards for (accounting for trade/lineup/binder/marketplace locks). This is the source of truth. Client-side matching from `collection` is not used, since it cannot account for lock state and would show false positives.

## Database Migration

File: `database/migrations/101-bounty-board.sql`

Creates:
- `cc_bounties` table with indexes
- No new permissions needed — bounty board is available to all authenticated vault users

## Edge Cases

- **Race condition on fulfillment**: Two users try to fulfill the same bounty simultaneously. Use `SELECT ... FOR UPDATE` on the bounty row within the transaction. First to lock wins, second gets "Bounty already fulfilled" error.
- **Card locked**: Fulfiller's matching card is in a trade/lineup/binder. Same lock checks as marketplace — reject with descriptive error.
- **Insufficient Core balance**: Checked at creation time. If somehow balance drops (shouldn't happen since escrow is immediate), the escrow debit itself would fail.
- **Self-fulfillment**: User posts a bounty and tries to turn in their own card. This should be **allowed** — user may want to recoup Cores from a card they find later, or may post speculatively.
- **Duplicate bounties**: Same user posts two bounties for the exact same card spec. Allowed (uses 2 of their 3 slots). Different prices create arbitrage opportunity but that's fine.
- **Expired bounty cleanup**: Lazy expiry on read — atomic `UPDATE ... WHERE status = 'active' AND expires_at < NOW() RETURNING *` prevents double-refund from concurrent requests.
- **Marketplace lock**: Cards listed on the marketplace cannot be used to fulfill bounties (added to lock checks alongside trade/lineup/binder).

## Performance

- Index on `cc_cards(owner_id, card_type, god_name, rarity)` to support the `fulfillable` endpoint join efficiently
- Lazy expiry runs at most once per expired bounty due to atomic status update
- Hero query is a simple `ORDER BY core_reward DESC LIMIT 5 WHERE status = 'active'` — covered by `idx_bounties_status`

## Future Considerations (Not in Scope)

- **Notifications**: Badge on Bounty tab when a user's bounty is fulfilled (similar to gift unseen count). Can be added later.
- **Challenge integration**: "Fulfill N bounties" or "Post N bounties" vault challenges.
- **Cooldown on cancel spam**: Currently fees are the only deterrent. If abuse emerges, add a cooldown where cancelled bounties count toward the 3-slot limit for some time period.

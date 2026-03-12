# Trade Anti-Abuse: Account Age Gate & One-Sided Trade Flagging

## Problem

Users can create alt Discord accounts, log in, receive free starter packs, and trade high-value cards to their main account with zero friction. Trading is currently free and unrestricted.

## Solution

Two complementary measures:

1. **Account age gate** — new accounts cannot trade until 7 days after first vault visit
2. **One-sided trade flagging** — trades with a value ratio >= 10x are silently logged for admin review

---

## Feature 1: Account Age Gate

### Behavior

- Users must have a `cc_stats` record at least 7 days old to trade
- Enforced on both trade creation (initiator) and trade join (recipient)
- Backend returns 403 with unlock date if account is too new
- Frontend proactively disables trade UI and shows unlock date

### Backend Changes

**`functions/lib/trading.js` — `createTrade()` and `joinTrade()`:**

Check `cc_stats.created_at` for the acting user. If no `cc_stats` row exists, treat as "too new" (account has never visited the vault). Reject if `NOW() - created_at < interval '7 days'`. The threshold is defined as a constant `TRADE_AGE_GATE_DAYS = 7` for easy tuning.

**Vault stats endpoint (`functions/api/vault.js`):**

Add two computed fields to the stats response:
- `can_trade` (boolean) — `true` if account age >= 7 days
- `trade_unlocks_at` (ISO timestamp or null) — `created_at + 7 days`, null if already unlocked

No new database columns. Both values derived from existing `cc_stats.created_at`. Added to `formatStats()` in vault.js and consumed via `useVault().stats` in trading components.

### Frontend Changes

**Trade initiation (CCTrading.jsx or wherever trade buttons live):**
- Disable "Start Trade" button when `can_trade` is false
- Show inline text: "Trading unlocks on {formatted date}"

**Trade invite acceptance:**
- Disable "Accept" on incoming trade invites when `can_trade` is false
- Same unlock message

### Database Migration

None required.

---

## Feature 2: One-Sided Trade Flagging

### Value System

Fixed rarity-based point values:

| Rarity    | Points |
|-----------|--------|
| Common    | 1      |
| Uncommon  | 3      |
| Rare      | 10     |
| Epic      | 30     |
| Legendary | 100    |
| Mythic    | 500    |

Ember (Core) conversion: **1 Ember = 1 point**.

### Flag Logic

Runs inside `confirmTrade()` after both players confirm, before the atomic swap executes.

1. Query all cards in the trade with their rarities
2. Sum points per side: `card_points + core_offered` (using `player_a_core` / `player_b_core` columns from `cc_trades`)
3. Flag if:
   - Either side's total value is 0 (completely one-sided), OR
   - `max(sideA, sideB) / max(min(sideA, sideB), 1) >= 10`
4. Insert flag record — trade still completes normally

### Database Migration

New table `cc_trade_flags`:

```sql
CREATE TABLE cc_trade_flags (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL REFERENCES cc_trades(id),
    reason TEXT NOT NULL CHECK (reason IN ('value_ratio', 'empty_side')),
    side_a_value NUMERIC NOT NULL, -- player_a total points
    side_b_value NUMERIC NOT NULL, -- player_b total points
    value_ratio NUMERIC NOT NULL,  -- max/min ratio
    reviewed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_flags_unreviewed ON cc_trade_flags(reviewed) WHERE reviewed = false;
```

### Backend Changes

**`functions/lib/trading.js` — `confirmTrade()`:**

After both players confirm and before executing the swap:

1. Query card rarities for all cards in the trade
2. Compute side values using the point table above + Ember amounts from `cc_trades`
3. Evaluate flag conditions
4. If flagged, INSERT into `cc_trade_flags` inside the same transaction — only completed trades get flagged (if the swap rolls back, so does the flag)

### Frontend Changes

None. Flagging is invisible to users.

### Admin Visibility

No admin UI in this iteration. Flags can be queried directly:

```sql
SELECT tf.*, t.player_a_id, t.player_b_id, ua.discord_username AS player_a, ub.discord_username AS player_b
FROM cc_trade_flags tf
JOIN cc_trades t ON t.id = tf.trade_id
JOIN users ua ON ua.id = t.player_a_id
JOIN users ub ON ub.id = t.player_b_id
WHERE tf.reviewed = false
ORDER BY tf.created_at DESC;
```

---

## Files Changed

| File | Change |
|------|--------|
| `functions/lib/trading.js` | Age check in createTrade/joinTrade, value calc + flagging in confirmTrade |
| `functions/api/vault.js` | Add can_trade/trade_unlocks_at to stats response |
| `src/pages/vault/CCTrading.jsx` | Disable trade buttons + show unlock message for new accounts |
| New migration SQL | cc_trade_flags table |

## Out of Scope

- Admin UI for reviewing flags (query directly for now)
- Trade tax / fees
- IP correlation detection
- Starter pack card binding
- Blocking lopsided trades (flagging only)
- Marketplace age gate (known gap — alts could list/buy on marketplace; address separately if it becomes a problem)

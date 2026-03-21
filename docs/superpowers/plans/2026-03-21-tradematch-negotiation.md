# TradeMatch Async Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the redirect-to-Trade-Room flow with an in-place async offer negotiation system inside TradeMatch.

**Architecture:** Add `offer_by`, `offer_status`, `offer_version` columns to `cc_trades` for match-mode trades. New negotiation business logic in `functions/lib/tradematch.js`. New `Negotiation.jsx` + `CardPicker.jsx` frontend components rendered inside `CCTradematch.jsx` as a fourth sub-view. Cards are NOT locked during negotiation — availability is checked on accept. Offer is a single mutable document (no history). One-click accept executes the swap immediately via a transaction reusing the same card transfer logic as direct trades.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-21-tradematch-async-negotiation-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/133-match-negotiation.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Match negotiation: async offer state on cc_trades

ALTER TABLE cc_trades ADD COLUMN offer_by INTEGER REFERENCES users(id);
ALTER TABLE cc_trades ADD COLUMN offer_status TEXT NOT NULL DEFAULT 'negotiating';
ALTER TABLE cc_trades ADD COLUMN offer_version INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Run migration**

Run: `psql $DATABASE_URL -f database/migrations/133-match-negotiation.sql`
Expected: Three ALTER TABLE statements succeed.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/133-match-negotiation.sql
git commit -m "feat(db): add offer negotiation columns to cc_trades"
```

---

### Task 2: Backend — Negotiation Business Logic

**Files:**
- Modify: `functions/lib/tradematch.js` (add negotiation functions after line 287)

- [ ] **Step 1: Update `TRADEMATCH_RULES` constant**

In `functions/lib/tradematch.js:4-9`, change `max_outgoing_matches` from 5 to 15 and add `max_cards_per_side`:

```js
export const TRADEMATCH_RULES = {
  min_trade_pile: 20,
  max_outgoing_matches: 15,
  max_cards_per_side: 10,
  match_expiry_hours: 24,
  feed_page_size: 50,
}
```

- [ ] **Step 2: Update `getMatches` to return offer state**

Replace the `getMatches` function at line 276-287 to include `offer_by`, `offer_status`, `offer_version` in the SELECT:

```js
export async function getMatches(sql, userId) {
  return sql`
    SELECT t.id, t.player_a_id, t.player_b_id, t.status, t.mode,
           t.player_a_core, t.player_b_core,
           t.offer_by, t.offer_status, t.offer_version,
           t.created_at, t.updated_at,
           u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${userId} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
      AND t.mode = 'match'
      AND t.status = 'active'
    ORDER BY t.updated_at DESC
  `
}
```

- [ ] **Step 3: Add `getOfferDetail` function**

Append to `functions/lib/tradematch.js`:

```js
// ══════════════════════════════════════════════
// Offer Negotiation
// ══════════════════════════════════════════════

export async function getOfferDetail(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT t.id, t.player_a_id, t.player_b_id, t.status, t.mode,
           t.player_a_core, t.player_b_core,
           t.offer_by, t.offer_status, t.offer_version,
           t.created_at, t.updated_at,
           ua.discord_username AS player_a_name, ua.discord_avatar AS player_a_avatar, ua.discord_id AS player_a_discord_id,
           ub.discord_username AS player_b_name, ub.discord_avatar AS player_b_avatar, ub.discord_id AS player_b_discord_id
    FROM cc_trades t
    JOIN users ua ON t.player_a_id = ua.id
    JOIN users ub ON t.player_b_id = ub.id
    WHERE t.id = ${tradeId}
      AND t.mode = 'match'
      AND (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')
  if (trade.status !== 'active') throw new Error('Trade is no longer active')

  // Get cards in offer
  const cards = await sql`
    SELECT tc.id, tc.card_id, tc.offered_by,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id, c.card_type, c.owner_id,
           c.template_id
    FROM cc_trade_cards tc
    JOIN cc_cards c ON tc.card_id = c.id
    WHERE tc.trade_id = ${tradeId}
  `

  // Check availability in batch — card must still be owned by the offerer
  // and not locked in a direct trade or marketplace listing
  const cardIds = cards.map(c => c.card_id)

  const lockedInTrade = cardIds.length > 0 ? await sql`
    SELECT DISTINCT tc2.card_id FROM cc_trade_cards tc2
    JOIN cc_trades t2 ON tc2.trade_id = t2.id
    WHERE tc2.card_id = ANY(${cardIds}) AND t2.status IN ('waiting', 'active') AND t2.mode = 'direct'
  ` : []
  const tradeLockedSet = new Set(lockedInTrade.map(r => r.card_id))

  const onMarketplace = cardIds.length > 0 ? await sql`
    SELECT DISTINCT card_id FROM cc_market_listings
    WHERE card_id = ANY(${cardIds}) AND status = 'active'
  ` : []
  const marketLockedSet = new Set(onMarketplace.map(r => r.card_id))

  const enrichedCards = cards.map(card => ({
    ...card,
    available: card.owner_id === card.offered_by
      && !tradeLockedSet.has(card.card_id)
      && !marketLockedSet.has(card.card_id),
  }))

  return { trade, cards: enrichedCards }
}
```

- [ ] **Step 4: Add `offerAddCard` function**

```js
export async function offerAddCard(sql, userId, tradeId, cardId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // If offer is pending and it was sent by the other person, reset to negotiating (implicit counter)
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', updated_at = NOW() WHERE id = ${tradeId}`
  }

  // Determine which side this card goes to
  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')

  const offeredBy = card.owner_id
  // Card must belong to one of the two traders
  if (offeredBy !== trade.player_a_id && offeredBy !== trade.player_b_id) {
    throw new Error('Card does not belong to either trader')
  }

  // Card must be in the owner's trade pile (prevents adding locked/binder/lineup cards via API)
  const [inPile] = await sql`
    SELECT 1 FROM cc_trade_pile WHERE user_id = ${offeredBy} AND card_id = ${cardId}
  `
  if (!inPile) throw new Error('Card is not in trade pile')

  // Check card limits per side
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${offeredBy}
  `
  if (count >= TRADEMATCH_RULES.max_cards_per_side) {
    throw new Error(`Maximum ${TRADEMATCH_RULES.max_cards_per_side} cards per side`)
  }

  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${tradeId}, ${cardId}, ${offeredBy})
    ON CONFLICT (trade_id, card_id) DO NOTHING
  `
}
```

- [ ] **Step 5: Add `offerRemoveCard` function**

```js
export async function offerRemoveCard(sql, userId, tradeId, cardId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // If offer is pending and it was sent by the other person, reset to negotiating
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', updated_at = NOW() WHERE id = ${tradeId}`
  }

  await sql`DELETE FROM cc_trade_cards WHERE trade_id = ${tradeId} AND card_id = ${cardId}`
}
```

- [ ] **Step 6: Add `offerSetCore` function**

```js
export async function offerSetCore(sql, userId, tradeId, amount) {
  const amt = Math.max(0, Math.floor(amount))

  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // If offer is pending from other side, reset to negotiating
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', updated_at = NOW() WHERE id = ${tradeId}`
  }

  const isA = trade.player_a_id === userId
  if (isA) {
    await sql`UPDATE cc_trades SET player_a_core = ${amt}, updated_at = NOW() WHERE id = ${tradeId}`
  } else {
    await sql`UPDATE cc_trades SET player_b_core = ${amt}, updated_at = NOW() WHERE id = ${tradeId}`
  }
}
```

- [ ] **Step 7: Add `offerSend` function**

```js
export async function offerSend(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // Must have at least something on your side
  const isA = trade.player_a_id === userId
  const myCore = isA ? trade.player_a_core : trade.player_b_core

  const [{ count: myCardCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId}
  `
  if (myCardCount === 0 && myCore === 0) {
    throw new Error('You must offer at least one card or some Cores')
  }

  await sql`
    UPDATE cc_trades
    SET offer_by = ${userId}, offer_status = 'pending', offer_version = offer_version + 1, updated_at = NOW()
    WHERE id = ${tradeId}
  `
}
```

- [ ] **Step 8: Add `offerAccept` function**

This reuses the same card transfer pattern from `trading.js:confirmTrade`. Import `grantEmber` and `ensureEmberBalance` at the top of the file.

Add import at top of `functions/lib/tradematch.js`:

```js
import { grantEmber, ensureEmberBalance } from './ember.js'
```

Then add the function:

```js
export async function offerAccept(tx, userId, tradeId, version) {
  // Lock trade row
  const [trade] = await tx`
    SELECT * FROM cc_trades WHERE id = ${tradeId} AND mode = 'match' AND status = 'active' FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  const isA = trade.player_a_id === userId
  const isB = trade.player_b_id === userId
  if (!isA && !isB) throw new Error('You are not in this trade')

  // Must be pending from the other person
  if (trade.offer_status !== 'pending') throw new Error('No pending offer to accept')
  if (trade.offer_by === userId) throw new Error('You cannot accept your own offer')

  // Optimistic concurrency check
  if (trade.offer_version !== version) throw new Error('Offer has changed — please review the updated offer')

  // Get all cards in the offer
  const items = await tx`SELECT * FROM cc_trade_cards WHERE trade_id = ${tradeId}`
  const aCards = items.filter(c => c.offered_by === trade.player_a_id)
  const bCards = items.filter(c => c.offered_by === trade.player_b_id)

  // Must have at least something
  if (items.length === 0 && trade.player_a_core === 0 && trade.player_b_core === 0) {
    throw new Error('Trade is empty')
  }

  // Verify card ownership + availability
  for (const tc of items) {
    const [card] = await tx`SELECT owner_id FROM cc_cards WHERE id = ${tc.card_id} FOR UPDATE`
    if (!card || card.owner_id !== tc.offered_by) {
      throw new Error('A card in the trade is no longer owned by the trader')
    }
    // Check not locked in direct trade
    const [locked] = await tx`
      SELECT 1 FROM cc_trade_cards tc2
      JOIN cc_trades t2 ON tc2.trade_id = t2.id
      WHERE tc2.card_id = ${tc.card_id} AND t2.status IN ('waiting', 'active') AND t2.mode = 'direct'
      LIMIT 1
    `
    if (locked) throw new Error('A card is locked in a direct trade')

    // Check not on marketplace
    const [onMarket] = await tx`
      SELECT 1 FROM cc_market_listings WHERE card_id = ${tc.card_id} AND status = 'active' LIMIT 1
    `
    if (onMarket) throw new Error('A card is listed on the marketplace')
  }

  // Verify Core affordability
  if (trade.player_a_core > 0) {
    await ensureEmberBalance(tx, trade.player_a_id)
    const [balA] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${trade.player_a_id} FOR UPDATE`
    if (!balA || balA.balance < trade.player_a_core) throw new Error('Player cannot afford their Core offer')
  }
  if (trade.player_b_core > 0) {
    await ensureEmberBalance(tx, trade.player_b_id)
    const [balB] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${trade.player_b_id} FOR UPDATE`
    if (!balB || balB.balance < trade.player_b_core) throw new Error('Player cannot afford their Core offer')
  }

  // ═══ EXECUTE SWAP ═══

  // Transfer cards
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

  // Clean up trade piles for swapped cards
  const allCardIds = items.map(c => c.card_id)
  if (allCardIds.length > 0) {
    await tx`DELETE FROM cc_trade_pile WHERE card_id = ANY(${allCardIds})`
  }

  // Transfer Cores
  if (trade.player_a_core > 0) {
    await grantEmber(tx, trade.player_a_id, 'cc_trade', -trade.player_a_core, `Match Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_b_id, 'cc_trade', trade.player_a_core, `Match Trade #${tradeId}: received Core`, tradeId)
  }
  if (trade.player_b_core > 0) {
    await grantEmber(tx, trade.player_b_id, 'cc_trade', -trade.player_b_core, `Match Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_a_id, 'cc_trade', trade.player_b_core, `Match Trade #${tradeId}: received Core`, tradeId)
  }

  // Mark trade completed
  await tx`
    UPDATE cc_trades
    SET status = 'completed', offer_status = 'accepted', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${tradeId}
  `

  return { status: 'completed' }
}
```

- [ ] **Step 9: Add `offerCancel` function**

```js
export async function offerCancel(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  await sql`UPDATE cc_trades SET status = 'cancelled', updated_at = NOW() WHERE id = ${tradeId}`
}
```

- [ ] **Step 10: Commit**

```bash
git add functions/lib/tradematch.js
git commit -m "feat(tradematch): add async offer negotiation business logic"
```

---

### Task 3: Backend — API Route Handlers

**Files:**
- Modify: `functions/api/tradematch.js`

- [ ] **Step 1: Add imports for new functions**

At `functions/api/tradematch.js:1-11`, update the imports:

```js
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  getTradePile, addToTradePile, removeFromTradePile, getTradePileCount,
  getSwipeFeed, recordSwipe,
  getLikes, createTradeFromLike,
  getMatches, getOfferDetail,
  offerAddCard, offerRemoveCard, offerSetCore, offerSend, offerAccept, offerCancel,
  TRADEMATCH_RULES,
} from '../lib/tradematch.js'
```

- [ ] **Step 2: Add GET route for `offer-detail`**

Add to the GET switch block (after line 44):

```js
case 'offer-detail': return await handleOfferDetail(sql, user, event.queryStringParameters)
```

Handler function:

```js
async function handleOfferDetail(sql, user, params) {
  const tradeId = parseInt(params.tradeId)
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  const result = await getOfferDetail(sql, user.id, tradeId)
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}
```

- [ ] **Step 3: Add POST routes for offer actions**

Add to the POST switch block (after line 55):

```js
case 'offer-add-card': return await handleOfferAddCard(sql, user, body)
case 'offer-remove-card': return await handleOfferRemoveCard(sql, user, body)
case 'offer-set-core': return await handleOfferSetCore(sql, user, body)
case 'offer-send': return await handleOfferSend(sql, user, body)
case 'offer-accept': return await handleOfferAcceptRoute(user, body)
case 'offer-cancel': return await handleOfferCancel(sql, user, body)
```

Handler functions:

```js
async function handleOfferAddCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }
  await offerAddCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferRemoveCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }
  await offerRemoveCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferSetCore(sql, user, body) {
  const { tradeId, amount } = body
  if (!tradeId || amount === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and amount required' }) }
  await offerSetCore(sql, user.id, parseInt(tradeId), parseInt(amount))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferSend(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  await offerSend(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferAcceptRoute(user, body) {
  const { tradeId, version } = body
  if (!tradeId || version === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and version required' }) }
  const result = await transaction(async (tx) => {
    return offerAccept(tx, user.id, parseInt(tradeId), parseInt(version))
  })
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleOfferCancel(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  await offerCancel(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/tradematch.js
git commit -m "feat(tradematch): add API routes for offer negotiation"
```

---

### Task 4: Frontend — Service Layer

**Files:**
- Modify: `src/services/database.js:1274-1302`

- [ ] **Step 1: Add new methods to `tradematchService`**

Add after the `matches()` method (before the closing `}`):

```js
    async offerDetail(tradeId) {
        return apiCall('tradematch', { action: 'offer-detail', tradeId: String(tradeId) })
    },
    async offerAddCard(tradeId, cardId) {
        return apiPost('tradematch', { action: 'offer-add-card' }, { tradeId, cardId })
    },
    async offerRemoveCard(tradeId, cardId) {
        return apiPost('tradematch', { action: 'offer-remove-card' }, { tradeId, cardId })
    },
    async offerSetCore(tradeId, amount) {
        return apiPost('tradematch', { action: 'offer-set-core' }, { tradeId, amount })
    },
    async offerSend(tradeId) {
        return apiPost('tradematch', { action: 'offer-send' }, { tradeId })
    },
    async offerAccept(tradeId, version) {
        return apiPost('tradematch', { action: 'offer-accept' }, { tradeId, version })
    },
    async offerCancel(tradeId) {
        return apiPost('tradematch', { action: 'offer-cancel' }, { tradeId })
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(tradematch): add offer negotiation service methods"
```

---

### Task 5: Frontend — CardPicker Modal

**Files:**
- Create: `src/pages/vault/tradematch/CardPicker.jsx`

**Context:** This modal shows a trade pile (yours or theirs) filtered to cards not already in the offer. User taps a card to add it. Re-uses the existing `CardThumb` pattern from `MatchesAndLikes.jsx` but needs to render with holo. Reference how `VaultCard.jsx` renders holo cards — it uses `TradingCardHolo` wrapper. The `CardThumb` component in `MatchesAndLikes.jsx` (lines 47-99) uses `GameCard` for god/item/consumable cards and `TradingCard` for player cards — but doesn't apply holo. The new `CardPicker` needs to show holo overlays.

- [ ] **Step 1: Create the CardPicker component**

```jsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'

const CARD_SIZE = 80

function PickerCard({ card, onSelect, disabled }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const override = !isPlayer ? getDefOverride({ cardType: type, godId: card.god_id }) : null
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null

  let inner
  if (isPlayer) {
    inner = (
      <TradingCard
        playerName={card.god_name || card.player_name}
        teamName={cd.teamName || ''}
        teamColor={cd.teamColor || '#6366f1'}
        role={cd.role || 'ADC'}
        avatarUrl={card.image_url || ''}
        rarity={card.rarity}
        leagueName={cd.leagueName || ''}
        divisionName={cd.divisionName || ''}
        bestGod={cd.bestGodName ? { name: cd.bestGodName } : null}
        isConnected={cd.isConnected}
        isFirstEdition={card.serial_number === 1}
        signatureUrl={cd.signatureUrl}
        size={CARD_SIZE}
        holo={holoEffect ? { rarity: holoEffect, holoType: holoType || 'reverse' } : undefined}
      />
    )
  } else {
    const gameCardEl = (
      <GameCard
        type={type}
        rarity={card.rarity}
        data={{
          name: card.god_name || card.player_name,
          imageUrl: override?.custom_image_url || card.image_url,
          id: card.god_id,
          serialNumber: card.serial_number,
          metadata: override || undefined,
          role: cd.role,
          ability: cd.ability,
          class: cd.class,
          category: cd.category,
          manaCost: cd.manaCost,
          effects: cd.effects,
          passive: cd.passive,
          color: cd.color,
          description: cd.description,
          imageKey: cd.imageKey,
        }}
        size={CARD_SIZE}
      />
    )
    inner = holoEffect ? (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={CARD_SIZE}>
        {gameCardEl}
      </TradingCardHolo>
    ) : gameCardEl
  }

  return (
    <button
      onClick={() => !disabled && onSelect(card)}
      disabled={disabled}
      className={`relative rounded-lg transition-all cursor-pointer ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
    >
      {inner}
    </button>
  )
}

export default function CardPicker({ side, tradeId, partnerId, existingCardIds, onAdd, onClose }) {
  const [cards, setCards] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Load trade pile
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = side === 'mine'
      ? tradematchService.tradePile()
      : tradematchService.tradePileView(partnerId)

    load.then(data => {
      if (!cancelled) {
        setCards(data.cards || [])
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) { setCards([]); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [side, partnerId])

  const filtered = useMemo(() => {
    if (!cards) return []
    let list = cards.filter(c => !existingCardIds.has(c.card_id))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.god_name || '').toLowerCase().includes(q) ||
        (c.rarity || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [cards, existingCardIds, search])

  const handleSelect = useCallback((card) => {
    onAdd(card.card_id)
    onClose()
  }, [onAdd, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cd-border)]">
          <h3 className="cd-head text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--cd-text)' }}>
            {side === 'mine' ? 'Your Trade Pile' : "Their Trade Pile"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-4 h-4" style={{ color: 'var(--cd-text-dim)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-[var(--cd-border)]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--cd-text-dim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--cd-edge)] text-[var(--cd-text)] border border-[var(--cd-border)] outline-none focus:border-[var(--cd-cyan)]"
            />
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--cd-cyan)', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--cd-text-dim)' }}>
              {search ? 'No matching cards' : 'No available cards'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {filtered.map(card => (
                <PickerCard
                  key={card.card_id}
                  card={card}
                  onSelect={handleSelect}
                  disabled={existingCardIds.has(card.card_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/CardPicker.jsx
git commit -m "feat(tradematch): add CardPicker modal for offer negotiation"
```

---

### Task 6: Frontend — Negotiation Component

**Files:**
- Create: `src/pages/vault/tradematch/Negotiation.jsx`

**Context:** This is the main negotiation UI. It shows the two-column offer layout with "Your Offer" / "You Want" sides, dashed "+ Add card" slots, Cores input, and action buttons. Uses the same `CardThumb`-style rendering from MatchesAndLikes but with holo applied. Needs to handle the `offer_status` states (negotiating, pending) and the current user's perspective (am I player_a or player_b?).

- [ ] **Step 1: Create the Negotiation component**

```jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, Send, Check, X, RotateCcw, Loader2, AlertTriangle, Gem } from 'lucide-react'
import GameCard from '../components/GameCard'
import TradingCard from '../../../components/TradingCard'
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
import { useVault } from '../VaultContext'
import { tradematchService } from '../../../services/database'
import CardPicker from './CardPicker'

const CARD_SIZE = 90

function OfferCard({ card, onRemove, showRemove }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const override = !isPlayer ? getDefOverride({ cardType: type, godId: card.god_id }) : null
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null
  const unavailable = card.available === false

  let inner
  if (isPlayer) {
    inner = (
      <TradingCard
        playerName={card.god_name}
        teamName={cd.teamName || ''}
        teamColor={cd.teamColor || '#6366f1'}
        role={cd.role || 'ADC'}
        avatarUrl={card.image_url || ''}
        rarity={card.rarity}
        leagueName={cd.leagueName || ''}
        divisionName={cd.divisionName || ''}
        bestGod={cd.bestGodName ? { name: cd.bestGodName } : null}
        isConnected={cd.isConnected}
        isFirstEdition={card.serial_number === 1}
        signatureUrl={cd.signatureUrl}
        size={CARD_SIZE}
        holo={holoEffect ? { rarity: holoEffect, holoType: holoType || 'reverse' } : undefined}
      />
    )
  } else {
    const gameCardEl = (
      <GameCard
        type={type}
        rarity={card.rarity}
        data={{
          name: card.god_name,
          imageUrl: override?.custom_image_url || card.image_url,
          id: card.god_id,
          serialNumber: card.serial_number,
          metadata: override || undefined,
          role: cd.role, ability: cd.ability, class: cd.class,
          category: cd.category, manaCost: cd.manaCost,
          effects: cd.effects, passive: cd.passive,
          color: cd.color, description: cd.description, imageKey: cd.imageKey,
        }}
        size={CARD_SIZE}
      />
    )
    inner = holoEffect ? (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={CARD_SIZE}>
        {gameCardEl}
      </TradingCardHolo>
    ) : gameCardEl
  }

  return (
    <div className="relative group">
      {inner}
      {unavailable && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-red-900/60 border-2 border-red-500/60">
          <div className="text-center">
            <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-0.5" />
            <span className="text-[9px] font-bold text-red-300 cd-head">UNAVAILABLE</span>
          </div>
        </div>
      )}
      {showRemove && (
        <button
          onClick={() => onRemove(card.card_id)}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        >
          <X className="w-3 h-3" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

function AddCardSlot({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-lg border-2 border-dashed transition-all cursor-pointer hover:border-[var(--cd-cyan)] hover:bg-[var(--cd-cyan)]/5"
      style={{
        width: CARD_SIZE, height: CARD_SIZE * 1.4,
        borderColor: 'var(--cd-border)',
      }}
    >
      <span className="text-2xl font-light" style={{ color: 'var(--cd-text-dim)' }}>+</span>
    </button>
  )
}

export default function Negotiation({ tradeId, userId, onBack, onComplete }) {
  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [pickerSide, setPickerSide] = useState(null) // 'mine' | 'theirs' | null
  const [coreInput, setCoreInput] = useState('')

  const fetchOffer = useCallback(async () => {
    try {
      const data = await tradematchService.offerDetail(tradeId)
      setOffer(data)
      const isA = data.trade.player_a_id === userId
      const myCore = isA ? data.trade.player_a_core : data.trade.player_b_core
      setCoreInput(myCore > 0 ? String(myCore) : '')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tradeId, userId])

  useEffect(() => { fetchOffer() }, [fetchOffer])

  // Refetch on tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOffer()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchOffer])

  const trade = offer?.trade
  const isA = trade?.player_a_id === userId
  const partnerId = isA ? trade?.player_b_id : trade?.player_a_id
  const partnerName = isA ? trade?.player_b_name : trade?.player_a_name

  const myCards = useMemo(() =>
    (offer?.cards || []).filter(c => c.offered_by === userId),
  [offer, userId])

  const theirCards = useMemo(() =>
    (offer?.cards || []).filter(c => c.offered_by !== userId),
  [offer, userId])

  const allCardIds = useMemo(() =>
    new Set((offer?.cards || []).map(c => c.card_id)),
  [offer])

  const myCore = trade ? (isA ? trade.player_a_core : trade.player_b_core) : 0
  const theirCore = trade ? (isA ? trade.player_b_core : trade.player_a_core) : 0

  const hasUnavailable = (offer?.cards || []).some(c => !c.available)
  const isPendingFromMe = trade?.offer_status === 'pending' && trade?.offer_by === userId
  const isPendingFromThem = trade?.offer_status === 'pending' && trade?.offer_by !== userId
  const isNegotiating = trade?.offer_status === 'negotiating'
  const canEdit = isNegotiating || isPendingFromThem
  const canSend = canEdit && !hasUnavailable && (myCards.length > 0 || myCore > 0)

  const doAction = useCallback(async (fn) => {
    setActionLoading(true)
    setError(null)
    try {
      await fn()
      await fetchOffer()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }, [fetchOffer])

  const handleAddCard = useCallback((cardId) => {
    doAction(() => tradematchService.offerAddCard(tradeId, cardId))
  }, [tradeId, doAction])

  const handleRemoveCard = useCallback((cardId) => {
    doAction(() => tradematchService.offerRemoveCard(tradeId, cardId))
  }, [tradeId, doAction])

  const handleSetCore = useCallback(() => {
    const amt = parseInt(coreInput) || 0
    doAction(() => tradematchService.offerSetCore(tradeId, amt))
  }, [tradeId, coreInput, doAction])

  const handleSend = useCallback(() => {
    doAction(() => tradematchService.offerSend(tradeId))
  }, [tradeId, doAction])

  const handleAccept = useCallback(async () => {
    setActionLoading(true)
    setError(null)
    try {
      await tradematchService.offerAccept(tradeId, trade.offer_version)
      setSuccess('Trade completed!')
      setTimeout(() => onComplete(), 2000)
    } catch (err) {
      setError(err.message)
      await fetchOffer()
    } finally {
      setActionLoading(false)
    }
  }, [tradeId, trade?.offer_version, fetchOffer, onComplete])

  const handleCancel = useCallback(() => {
    doAction(async () => {
      await tradematchService.offerCancel(tradeId)
      onBack()
    })
  }, [tradeId, doAction, onBack])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cd-cyan)' }} />
      </div>
    )
  }

  if (!trade) {
    return (
      <div className="text-center py-12">
        <p className="text-sm" style={{ color: 'var(--cd-text-dim)' }}>{error || 'Trade not found'}</p>
        <button onClick={onBack} className="mt-4 text-xs text-[var(--cd-cyan)] cursor-pointer">Go back</button>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-4 text-xs font-bold cd-head tracking-wider cursor-pointer transition-colors hover:text-[var(--cd-cyan)]"
        style={{ color: 'var(--cd-text-dim)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Matches
      </button>

      {/* Partner info + status */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-xl" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--cd-text)' }}>
          Trading with <span style={{ color: 'var(--cd-cyan)' }}>@{partnerName}</span>
        </span>
        <span className={`text-[10px] font-bold cd-head tracking-wider px-2 py-0.5 rounded-full ${
          isPendingFromMe ? 'bg-amber-500/15 text-amber-400'
          : isPendingFromThem ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)]'
        }`}>
          {isPendingFromMe ? 'WAITING...' : isPendingFromThem ? 'THEIR OFFER' : 'NEGOTIATING'}
        </span>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {success}
        </div>
      )}

      {/* Two-column offer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Your offer side */}
        <div className="rounded-xl p-4" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
          <h3 className="cd-head text-xs font-bold tracking-wider uppercase mb-3" style={{ color: 'var(--cd-text-dim)' }}>
            Your Offer
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {myCards.map(card => (
              <OfferCard
                key={card.card_id}
                card={card}
                onRemove={handleRemoveCard}
                showRemove={canEdit}
              />
            ))}
            {canEdit && <AddCardSlot onClick={() => setPickerSide('mine')} />}
          </div>
          {/* Core input */}
          <div className="flex items-center gap-2 mt-2">
            <Gem className="w-3.5 h-3.5 text-amber-400" />
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  value={coreInput}
                  onChange={e => setCoreInput(e.target.value)}
                  onBlur={handleSetCore}
                  placeholder="0"
                  className="w-20 px-2 py-1 rounded text-xs bg-[var(--cd-edge)] text-[var(--cd-text)] border border-[var(--cd-border)] outline-none focus:border-[var(--cd-cyan)]"
                />
                <span className="text-[10px]" style={{ color: 'var(--cd-text-dim)' }}>Cores</span>
              </div>
            ) : (
              <span className="text-xs font-semibold" style={{ color: 'var(--cd-text)' }}>{myCore} Cores</span>
            )}
          </div>
        </div>

        {/* You want side */}
        <div className="rounded-xl p-4" style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}>
          <h3 className="cd-head text-xs font-bold tracking-wider uppercase mb-3" style={{ color: 'var(--cd-text-dim)' }}>
            You Want
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {theirCards.map(card => (
              <OfferCard
                key={card.card_id}
                card={card}
                onRemove={handleRemoveCard}
                showRemove={canEdit}
              />
            ))}
            {canEdit && <AddCardSlot onClick={() => setPickerSide('theirs')} />}
          </div>
          {/* Their core display */}
          <div className="flex items-center gap-2 mt-2">
            <Gem className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold" style={{ color: 'var(--cd-text)' }}>{theirCore} Cores</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        {isPendingFromMe && (
          <p className="text-xs" style={{ color: 'var(--cd-text-dim)' }}>
            Waiting for @{partnerName} to respond...
          </p>
        )}

        {isPendingFromThem && (
          <>
            <button
              onClick={handleAccept}
              disabled={actionLoading || hasUnavailable}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Accept
            </button>
            <button
              onClick={() => {
                // Counter: just start editing (offer_status resets on first change via backend)
                setError(null)
              }}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider transition-all active:scale-95 cursor-pointer"
              style={{ color: 'var(--cd-cyan)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Counter
            </button>
          </>
        )}

        {isNegotiating && (
          <button
            onClick={handleSend}
            disabled={actionLoading || !canSend}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-white transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Offer
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cd-head tracking-wider text-red-400 transition-all active:scale-95 cursor-pointer border border-red-500/20 hover:bg-red-500/5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>

      {/* Card picker modal */}
      {pickerSide && (
        <CardPicker
          side={pickerSide === 'mine' ? 'mine' : 'theirs'}
          tradeId={tradeId}
          partnerId={partnerId}
          existingCardIds={allCardIds}
          onAdd={handleAddCard}
          onClose={() => setPickerSide(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/Negotiation.jsx
git commit -m "feat(tradematch): add Negotiation component for async offer UI"
```

---

### Task 7: Frontend — Wire Up CCTradematch + MatchesAndLikes

**Files:**
- Modify: `src/pages/vault/CCTradematch.jsx`
- Modify: `src/pages/vault/tradematch/MatchesAndLikes.jsx`

- [ ] **Step 1: Update CCTradematch to show Negotiation instead of redirecting**

In `src/pages/vault/CCTradematch.jsx`:

1. Add import for Negotiation:
```js
import Negotiation from './tradematch/Negotiation'
```

2. Add state for active negotiation:
```js
const [activeTradeId, setActiveTradeId] = useState(null)
```

3. Replace `handleOpenTrade` (line 179-181):
```js
const handleOpenTrade = useCallback((tradeId) => {
  setActiveTradeId(tradeId)
}, [])
```

4. Add `handleNegotiationBack` and `handleNegotiationComplete`:
```js
const handleNegotiationBack = useCallback(() => {
  setActiveTradeId(null)
  // Refetch matches
  Promise.all([
    tradematchService.matches(),
    tradematchService.likes(),
  ]).then(([matchData, likeData]) => {
    setMatches(matchData.matches || [])
    setLikes(likeData.likes || [])
    setMatchTradeCount(matchData.matches?.length || 0)
  })
}, [setMatchTradeCount])

const handleNegotiationComplete = useCallback(() => {
  setActiveTradeId(null)
  // Refetch
  Promise.all([
    tradematchService.matches(),
    tradematchService.likes(),
  ]).then(([matchData, likeData]) => {
    setMatches(matchData.matches || [])
    setLikes(likeData.likes || [])
    setMatchTradeCount(matchData.matches?.length || 0)
  })
}, [setMatchTradeCount])
```

5. Add visibility change listener for refetching matches (after existing useEffects):
```js
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && subView === 'matches') {
      Promise.all([
        tradematchService.matches(),
        tradematchService.likes(),
      ]).then(([matchData, likeData]) => {
        setMatches(matchData.matches || [])
        setLikes(likeData.likes || [])
      }).catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  return () => document.removeEventListener('visibilitychange', handleVisibility)
}, [subView])
```

6. Update MatchSplash `onOpenTrade` to use new handler — already handled since MatchSplash calls `handleOpenTrade`.

7. In the render, add negotiation view. When `activeTradeId` is set, show Negotiation instead of the normal sub-views:

Replace the JSX return (line 189 onwards). Before the sub-view tabs, check for active negotiation:

```jsx
{/* Active negotiation replaces everything */}
{activeTradeId ? (
  <Negotiation
    tradeId={activeTradeId}
    userId={user?.id}
    onBack={handleNegotiationBack}
    onComplete={handleNegotiationComplete}
  />
) : (
  <>
    {/* Sub-view switcher - existing code */}
    ...
    {/* Sub-views - existing code */}
  </>
)}
```

8. Get `user` from `useAuth()` — add import and hook call:
```js
import { useAuth } from '../../context/AuthContext'
// inside component:
const { user } = useAuth()
```

- [ ] **Step 2: Update MatchesAndLikes to show offer status**

In `src/pages/vault/tradematch/MatchesAndLikes.jsx`, update the `MatchItem` component to show whose turn it is:

In the `MatchItem` function (line 101-141), add offer status display. Replace the "TRADE" text in the button with dynamic status:

```jsx
function MatchItem({ match, onOpenTrade, userId }) {
  const remaining = timeRemaining(match.created_at)
  const expiringSoon = remaining !== 'Expired' && !remaining.includes('h')
  const isPendingFromMe = match.offer_status === 'pending' && match.offer_by === userId
  const isPendingFromThem = match.offer_status === 'pending' && match.offer_by !== userId

  return (
    <button
      onClick={() => onOpenTrade(match.id)}
      className="w-full text-left flex items-center gap-3 rounded-xl px-4 py-3 transition-all active:scale-[0.98] cursor-pointer"
      style={{
        background: 'var(--cd-surface)',
        border: `1px solid ${isPendingFromThem ? 'rgba(34,197,94,0.4)' : 'var(--cd-border)'}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cd-cyan)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isPendingFromThem ? 'rgba(34,197,94,0.4)' : 'var(--cd-border)' }}
    >
      <Avatar discord_id={match.partner_discord_id} avatar={match.partner_avatar} username={match.partner_name} size={44} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--cd-text)' }}>
          @{match.partner_name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3 flex-shrink-0" style={{ color: expiringSoon ? '#f59e0b' : 'var(--cd-text-dim)' }} />
          <span className="text-xs" style={{ color: expiringSoon ? '#f59e0b' : 'var(--cd-text-dim)' }}>
            {remaining}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isPendingFromThem ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold cd-head tracking-wider text-emerald-400">REVIEW</span>
          </>
        ) : isPendingFromMe ? (
          <>
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold cd-head tracking-wider text-amber-400">SENT</span>
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4" style={{ color: 'var(--cd-cyan)' }} />
            <span className="text-xs font-semibold cd-head tracking-wider" style={{ color: 'var(--cd-cyan)' }}>TRADE</span>
          </>
        )}
      </div>
    </button>
  )
}
```

Update `MatchesAndLikes` to accept and pass `userId`:

```jsx
export default function MatchesAndLikes({ matches, likes, onOpenTrade, onLikesTrade, loading, userId }) {
```

And pass `userId` to `MatchItem`:
```jsx
<MatchItem key={match.id} match={match} onOpenTrade={onOpenTrade} userId={userId} />
```

- [ ] **Step 3: Pass userId to MatchesAndLikes from CCTradematch**

In the `CCTradematch.jsx` render where `MatchesAndLikes` is used, add `userId={user?.id}`:

```jsx
<MatchesAndLikes
  matches={matches}
  likes={likes}
  onOpenTrade={handleOpenTrade}
  onLikesTrade={handleLikesTrade}
  loading={loading}
  userId={user?.id}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/CCTradematch.jsx src/pages/vault/tradematch/MatchesAndLikes.jsx
git commit -m "feat(tradematch): wire up negotiation flow, replace redirect with inline UI"
```

---

### Task 8: Fix Holo Rendering on CardThumb in MatchesAndLikes

**Files:**
- Modify: `src/pages/vault/tradematch/MatchesAndLikes.jsx:47-99`

**Context:** The existing `CardThumb` component in MatchesAndLikes renders cards WITHOUT holo effects. The `GameCard` component doesn't natively support holo — it needs to be wrapped in `TradingCardHolo`. The `TradingCard` component accepts a `holo` prop. Fix both paths.

- [ ] **Step 1: Add holo imports and update CardThumb**

Add imports at the top of `MatchesAndLikes.jsx`:
```js
import TradingCardHolo from '../../../components/TradingCardHolo'
import { getHoloEffect } from '../../../data/vault/economy'
```

Replace the `CardThumb` function (lines 47-99):

```jsx
function CardThumb({ card }) {
  const { getDefOverride } = useVault()
  const cd = card.card_data || {}
  const type = card.card_type || cd.cardType || 'god'
  const isPlayer = type === 'player' || cd.teamName
  const override = !isPlayer ? getDefOverride({ cardType: type, godId: card.god_id }) : null
  const holoType = card.holo_type || card.holoType || null
  const holoEffect = holoType ? getHoloEffect(card.rarity) : null
  const size = 70

  if (isPlayer) {
    return (
      <TradingCard
        playerName={card.god_name || card.player_name}
        teamName={cd.teamName || ''}
        teamColor={cd.teamColor || '#6366f1'}
        role={cd.role || 'ADC'}
        avatarUrl={card.image_url || ''}
        rarity={card.rarity}
        leagueName={cd.leagueName || ''}
        divisionName={cd.divisionName || ''}
        bestGod={cd.bestGodName ? { name: cd.bestGodName } : null}
        isConnected={cd.isConnected}
        isFirstEdition={card.serial_number === 1}
        signatureUrl={cd.signatureUrl}
        size={size}
        holo={holoEffect ? { rarity: holoEffect, holoType: holoType || 'reverse' } : undefined}
      />
    )
  }

  const gameCardEl = (
    <GameCard
      type={type}
      rarity={card.rarity}
      data={{
        name: card.god_name || card.player_name,
        imageUrl: override?.custom_image_url || card.image_url,
        id: card.god_id,
        serialNumber: card.serial_number,
        metadata: override || undefined,
        role: cd.role, ability: cd.ability, class: cd.class,
        category: cd.category, manaCost: cd.manaCost,
        effects: cd.effects, passive: cd.passive,
        color: cd.color, description: cd.description, imageKey: cd.imageKey,
      }}
      size={size}
    />
  )

  if (holoEffect) {
    return (
      <TradingCardHolo rarity={holoEffect} holoType={holoType || 'reverse'} size={size}>
        {gameCardEl}
      </TradingCardHolo>
    )
  }

  return gameCardEl
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/tradematch/MatchesAndLikes.jsx
git commit -m "fix(tradematch): render holo effects on CardThumb in matches and likes"
```

---

### Task 9: Integration Test + Verify

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual test flow**

Run: `npm start`

Test the following flow:
1. Go to Vault → TradeMatch → Matches
2. Click on an active match — should open Negotiation view inline (no page reload)
3. See pre-seeded cards from the match
4. Click "+ Add card" on your side → CardPicker opens showing your trade pile with holo effects
5. Click "+ Add card" on "You Want" side → CardPicker opens showing their trade pile
6. Set Cores amount
7. Click "Send Offer"
8. Verify status shows "WAITING..."
9. Test with second account: see "THEIR OFFER" → Accept / Counter / Cancel
10. Verify holo effects render on all cards in the negotiation

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(tradematch): integration fixes for async negotiation"
```

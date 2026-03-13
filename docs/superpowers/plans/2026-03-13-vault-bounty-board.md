# Vault Bounty Board Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wild-west-themed bounty board to the Vault where users post wanted requests for specific cards, escrowing Core currency as a reward for instant fulfillment.

**Architecture:** New `cc_bounties` table, new `functions/api/bounty.js` endpoint with `functions/lib/bounty.js` business logic, new Vault tab with `CCBountyBoard` orchestrator + sub-components. Follows existing marketplace/trading patterns for atomic transactions, card locking, and Core currency escrow via `grantEmber`.

**Tech Stack:** React 19, Tailwind CSS 4, Cloudflare Pages Functions, Neon PostgreSQL, `grantEmber` for Core transfers

**Spec:** `docs/superpowers/specs/2026-03-13-vault-bounty-board-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `database/migrations/101-bounty-board.sql` | `cc_bounties` table + indexes + performance index on `cc_cards` |
| `functions/lib/bounty.js` | Business logic: create, fulfill, cancel, expire, fee calculation |
| `functions/api/bounty.js` | API endpoint: action-based routing, request handlers |
| `src/pages/vault/CCBountyBoard.jsx` | Tab orchestrator: state, data fetching, view switching |
| `src/pages/vault/bounty/HeroPinboard.jsx` | Top-5 highest-reward bounties in scattered poster layout |
| `src/pages/vault/bounty/BountyGrid.jsx` | Filtered grid of wanted posters + pagination |
| `src/pages/vault/bounty/CreateBountyForm.jsx` | Modal form for posting bounties + live poster preview |
| `src/pages/vault/components/WantedPoster.jsx` | Individual wanted poster with taped mugshot design |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/VaultPage.jsx` | Add bounty tab to TABS + TAB_COMPONENTS + lazy import |
| `src/services/database.js` | Add `bountyService` export |

---

## Chunk 1: Database + Backend

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/101-bounty-board.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Bounty Board — wanted card requests with Core escrow
CREATE TABLE cc_bounties (
    id              SERIAL PRIMARY KEY,
    poster_id       INTEGER NOT NULL REFERENCES users(id),
    card_type       VARCHAR(20) NOT NULL,
    card_name       VARCHAR(200) NOT NULL,
    rarity          VARCHAR(20) NOT NULL,
    holo_type       VARCHAR(20),
    core_reward     INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    fulfilled_by    INTEGER REFERENCES users(id),
    fulfilled_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_bounties_status ON cc_bounties(status);
CREATE INDEX idx_bounties_poster ON cc_bounties(poster_id);
CREATE INDEX idx_bounties_expires ON cc_bounties(expires_at) WHERE status = 'active';
CREATE INDEX idx_bounties_card_spec ON cc_bounties(card_type, card_name, rarity) WHERE status = 'active';

-- Performance index for fulfillable endpoint (joining bounties against user's cards)
CREATE INDEX idx_cards_bounty_match ON cc_cards(owner_id, card_type, god_name, rarity);
```

- [ ] **Step 2: Apply migration to Neon database**

Run the SQL against the Neon database manually.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/101-bounty-board.sql
git commit -m "feat(vault): add cc_bounties table for bounty board"
```

---

### Task 2: Backend Business Logic

**Files:**
- Create: `functions/lib/bounty.js`

**References:**
- `functions/lib/marketplace.js` — pattern for card lock checks, fee calculation
- `functions/lib/ember.js` — `grantEmber` for Core transfers
- `functions/lib/vault-data.js` — `GODS` array for god name validation

- [ ] **Step 1: Create `functions/lib/bounty.js`**

```javascript
// Bounty Board — Core-escrowed wanted card requests
import { grantEmber, ensureEmberBalance } from './ember.js'

export const BOUNTY_RULES = {
  max_active: 3,
  min_reward: 1,
  max_reward: 10000,
  expiry_days: 14,
  cancel_fee_percent: 0.25,
  expiry_fee_percent: 0.10,
  min_fee: 1,
}

export function calculateCancelFee(reward) {
  return Math.max(Math.floor(reward * BOUNTY_RULES.cancel_fee_percent), BOUNTY_RULES.min_fee)
}

export function calculateExpiryFee(reward) {
  return Math.max(Math.floor(reward * BOUNTY_RULES.expiry_fee_percent), BOUNTY_RULES.min_fee)
}

/**
 * Expire all stale bounties atomically. Returns refund info.
 * Must run inside a transaction to prevent double-refund.
 */
export async function expireStale(tx) {
  const expired = await tx`
    UPDATE cc_bounties
    SET status = 'expired', cancelled_at = NOW(), updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW()
    RETURNING *
  `
  const refunds = []
  for (const b of expired) {
    const fee = calculateExpiryFee(b.core_reward)
    const refund = b.core_reward - fee
    if (refund > 0) {
      await grantEmber(tx, b.poster_id, 'bounty_refund', refund,
        `Bounty expired: ${b.card_name} (${b.rarity})`, String(b.id))
    }
    refunds.push({ bountyId: b.id, posterId: b.poster_id, fee, refund })
  }
  return refunds
}

/**
 * Create a new bounty with Core escrow.
 * Must run inside a transaction.
 */
export async function createBounty(tx, userId, { cardType, cardName, rarity, holoType, coreReward }) {
  // Validate reward range
  if (!coreReward || coreReward < BOUNTY_RULES.min_reward || coreReward > BOUNTY_RULES.max_reward) {
    throw new Error(`Reward must be between ${BOUNTY_RULES.min_reward} and ${BOUNTY_RULES.max_reward} Core`)
  }

  // Check active bounty limit
  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_bounties
    WHERE poster_id = ${userId} AND status = 'active'
  `
  if (count >= BOUNTY_RULES.max_active) {
    throw new Error(`Maximum ${BOUNTY_RULES.max_active} active bounties allowed`)
  }

  // Lock balance row and check funds
  await ensureEmberBalance(tx, userId)
  const [bal] = await tx`
    SELECT balance FROM ember_balances
    WHERE user_id = ${userId}
    FOR UPDATE
  `
  if (!bal || bal.balance < coreReward) {
    throw new Error('Not enough Core')
  }

  // Escrow Core
  await grantEmber(tx, userId, 'bounty_escrow', -coreReward,
    `Bounty posted: ${cardName} (${rarity})`)

  // Create bounty
  const [bounty] = await tx`
    INSERT INTO cc_bounties (poster_id, card_type, card_name, rarity, holo_type, core_reward, expires_at)
    VALUES (${userId}, ${cardType}, ${cardName}, ${rarity}, ${holoType || null}, ${coreReward},
            NOW() + INTERVAL '14 days')
    RETURNING *
  `

  return bounty
}

/**
 * Fulfill a bounty — transfer card to poster, reward Core to fulfiller.
 * Must run inside a transaction.
 */
export async function fulfillBounty(tx, fulfillerId, { bountyId, cardId }) {
  // Lock bounty row
  const [bounty] = await tx`
    SELECT * FROM cc_bounties
    WHERE id = ${bountyId} AND status = 'active'
    FOR UPDATE
  `
  if (!bounty) throw new Error('Bounty not found or already fulfilled')

  // Verify card ownership
  const [card] = await tx`
    SELECT id, owner_id, card_type, god_name, rarity, holo_type
    FROM cc_cards WHERE id = ${cardId}
    FOR UPDATE
  `
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== fulfillerId) throw new Error('You do not own this card')

  // Verify card matches bounty spec
  if (card.card_type !== bounty.card_type) throw new Error('Card type does not match')
  if (card.god_name !== bounty.card_name) throw new Error('Card name does not match')
  if (card.rarity !== bounty.rarity) throw new Error('Card rarity does not match')
  if (bounty.holo_type && card.holo_type !== bounty.holo_type) throw new Error('Card holo type does not match')

  // Lock checks — same as marketplace
  const [tradeLock] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  if (tradeLock) throw new Error('Card is locked in an active trade')

  const [slotted] = await tx`
    SELECT role FROM cc_lineups
    WHERE user_id = ${fulfillerId} AND (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId})
  `
  if (slotted) throw new Error('Card is in your Starting 5 lineup — remove it first')

  const [bindered] = await tx`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (bindered) throw new Error('Card is in your binder — remove it first')

  const [listed] = await tx`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active' LIMIT 1
  `
  if (listed) throw new Error('Card is listed on the marketplace — cancel listing first')

  // Transfer card to poster
  await tx`UPDATE cc_cards SET owner_id = ${bounty.poster_id} WHERE id = ${cardId}`

  // Credit fulfiller with reward
  await grantEmber(tx, fulfillerId, 'bounty_reward', bounty.core_reward,
    `Bounty fulfilled: ${bounty.card_name} (${bounty.rarity})`, String(bountyId))

  // Mark bounty completed
  const [updated] = await tx`
    UPDATE cc_bounties
    SET status = 'completed', fulfilled_by = ${fulfillerId}, fulfilled_card_id = ${cardId},
        completed_at = NOW(), updated_at = NOW()
    WHERE id = ${bountyId}
    RETURNING *
  `

  return { bounty: updated, reward: bounty.core_reward }
}

/**
 * Cancel own bounty — refund minus 25% fee.
 */
export async function cancelBounty(tx, userId, bountyId) {
  const [bounty] = await tx`
    SELECT * FROM cc_bounties
    WHERE id = ${bountyId} AND poster_id = ${userId} AND status = 'active'
    FOR UPDATE
  `
  if (!bounty) throw new Error('Bounty not found or already closed')

  const fee = calculateCancelFee(bounty.core_reward)
  const refund = bounty.core_reward - fee

  if (refund > 0) {
    await grantEmber(tx, userId, 'bounty_refund', refund,
      `Bounty cancelled: ${bounty.card_name} (${bounty.rarity})`, String(bountyId))
  }

  const [updated] = await tx`
    UPDATE cc_bounties
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = ${bountyId}
    RETURNING *
  `

  return { bounty: updated, fee, refund }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/bounty.js
git commit -m "feat(vault): add bounty board business logic"
```

---

### Task 3: Backend API Endpoint

**Files:**
- Create: `functions/api/bounty.js`

**References:**
- `functions/api/marketplace.js` — action routing pattern
- `functions/lib/db.js` — `getDB`, `headers`, `transaction`
- `functions/lib/auth.js` — `requireAuth`
- `functions/lib/vault-data.js` — `GODS` for god name validation

- [ ] **Step 1: Create `functions/api/bounty.js`**

```javascript
// Bounty Board API — browse, create, fulfill, cancel bounties
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { createBounty, fulfillBounty, cancelBounty, expireStale, BOUNTY_RULES } from '../lib/bounty.js'
import { GODS, ITEMS, CONSUMABLES } from '../lib/vault-data.js'

const VALID_CARD_TYPES = ['god', 'player', 'item', 'consumable']
const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const VALID_HOLO_TYPES = ['holo', 'reverse', 'full']
const GOD_NAMES = new Set(GODS.map(g => g.name))
const ITEM_NAMES = new Set(ITEMS.map(i => i.name))
const CONSUMABLE_NAMES = new Set(CONSUMABLES.map(c => c.name))

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
    // Lazy expiry — only on list/hero reads (not every request)
    if (event.httpMethod === 'GET' && (action === 'list' || action === 'hero')) {
      const stale = await sql`SELECT id FROM cc_bounties WHERE status = 'active' AND expires_at < NOW() LIMIT 1`
      if (stale.length > 0) {
        await transaction(async (tx) => { await expireStale(tx) })
      }
    }

    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'list': return await handleList(sql, event.queryStringParameters)
        case 'my-bounties': return await handleMyBounties(sql, user)
        case 'fulfillable': return await handleFulfillable(sql, user)
        case 'hero': return await handleHero(sql)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create': return await handleCreate(event, user, body)
        case 'fulfill': return await handleFulfill(event, user, body)
        case 'cancel': return await handleCancel(event, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('bounty error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Browse active bounties ═══
async function handleList(sql, params) {
  const {
    page = '0', limit = '24', sort = 'newest',
    rarity, cardType, holoType, minPrice, maxPrice,
  } = params

  const offset = parseInt(page) * parseInt(limit)
  const lim = Math.min(parseInt(limit), 50)

  const rows = await sql`
    SELECT id, card_type, card_name, rarity, holo_type, core_reward, created_at, expires_at
    FROM cc_bounties
    WHERE status = 'active'
    ORDER BY created_at DESC
  `

  let filtered = Array.from(rows)

  if (rarity) {
    const rarities = rarity.split(',')
    filtered = filtered.filter(b => rarities.includes(b.rarity))
  }
  if (cardType) {
    const types = cardType.split(',')
    filtered = filtered.filter(b => types.includes(b.card_type))
  }
  if (holoType) {
    const holos = holoType.split(',')
    filtered = filtered.filter(b => holos.includes(b.holo_type))
  }
  if (minPrice) filtered = filtered.filter(b => b.core_reward >= parseInt(minPrice))
  if (maxPrice) filtered = filtered.filter(b => b.core_reward <= parseInt(maxPrice))

  // Sort
  switch (sort) {
    case 'reward_desc': filtered.sort((a, b) => b.core_reward - a.core_reward); break
    case 'reward_asc': filtered.sort((a, b) => a.core_reward - b.core_reward); break
    case 'expiring': filtered.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at)); break
    case 'newest': default: filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break
  }

  const total = filtered.length
  const page_items = filtered.slice(offset, offset + lim)

  return { statusCode: 200, headers, body: JSON.stringify({ bounties: page_items, total }) }
}

// ═══ GET: User's own bounties ═══
async function handleMyBounties(sql, user) {
  const rows = await sql`
    SELECT * FROM cc_bounties
    WHERE poster_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return { statusCode: 200, headers, body: JSON.stringify({ bounties: rows }) }
}

// ═══ GET: Bounties the user can fulfill ═══
async function handleFulfillable(sql, user) {
  const rows = await sql`
    SELECT DISTINCT b.id AS bounty_id
    FROM cc_bounties b
    JOIN cc_cards c ON c.card_type = b.card_type
      AND c.god_name = b.card_name
      AND c.rarity = b.rarity
      AND (b.holo_type IS NULL OR c.holo_type = b.holo_type)
    WHERE b.status = 'active'
      AND c.owner_id = ${user.id}
      AND NOT EXISTS (SELECT 1 FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id WHERE tc.card_id = c.id AND t.status IN ('waiting','active'))
      AND NOT EXISTS (SELECT 1 FROM cc_lineups l WHERE l.card_id = c.id OR l.god_card_id = c.id OR l.item_card_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM cc_binder_cards bc WHERE bc.card_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM cc_market_listings ml WHERE ml.card_id = c.id AND ml.status = 'active')
  `
  return { statusCode: 200, headers, body: JSON.stringify({ fulfillableIds: rows.map(r => r.bounty_id) }) }
}

// ═══ GET: Top 5 bounties by reward ═══
async function handleHero(sql) {
  const rows = await sql`
    SELECT id, card_type, card_name, rarity, holo_type, core_reward, created_at, expires_at
    FROM cc_bounties
    WHERE status = 'active'
    ORDER BY core_reward DESC
    LIMIT 5
  `
  return { statusCode: 200, headers, body: JSON.stringify({ bounties: rows }) }
}

// ═══ POST: Create bounty ═══
async function handleCreate(event, user, body) {
  const { cardType, cardName, rarity, holoType, coreReward } = body

  // Validate card spec
  if (!VALID_CARD_TYPES.includes(cardType)) throw new Error('Invalid card type')
  if (!VALID_RARITIES.includes(rarity)) throw new Error('Invalid rarity')
  if (holoType && !VALID_HOLO_TYPES.includes(holoType)) throw new Error('Invalid holo type')
  if (!cardName || typeof cardName !== 'string' || cardName.trim().length === 0) throw new Error('Card name required')

  // Validate card name exists for the given type
  if (cardType === 'god' && !GOD_NAMES.has(cardName)) {
    throw new Error(`Unknown god: ${cardName}`)
  }
  if (cardType === 'item' && !ITEM_NAMES.has(cardName)) {
    throw new Error(`Unknown item: ${cardName}`)
  }
  if (cardType === 'consumable' && !CONSUMABLE_NAMES.has(cardName)) {
    throw new Error(`Unknown consumable: ${cardName}`)
  }
  if (cardType === 'player') {
    const sql = getDB()
    const [def] = await sql`SELECT id FROM cc_player_defs WHERE player_name = ${cardName} LIMIT 1`
    if (!def) throw new Error(`Unknown player: ${cardName}`)
  }

  const result = await transaction(async (tx) => {
    return await createBounty(tx, user.id, {
      cardType, cardName: cardName.trim(), rarity, holoType: holoType || null,
      coreReward: parseInt(coreReward),
    })
  })

  return { statusCode: 200, headers, body: JSON.stringify({ bounty: result }) }
}

// ═══ POST: Fulfill bounty ═══
async function handleFulfill(event, user, body) {
  const { bountyId, cardId } = body
  if (!bountyId || !cardId) throw new Error('bountyId and cardId required')

  const result = await transaction(async (tx) => {
    return await fulfillBounty(tx, user.id, { bountyId: parseInt(bountyId), cardId: parseInt(cardId) })
  })

  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

// ═══ POST: Cancel bounty ═══
async function handleCancel(event, user, body) {
  const { bountyId } = body
  if (!bountyId) throw new Error('bountyId required')

  const result = await transaction(async (tx) => {
    return await cancelBounty(tx, user.id, parseInt(bountyId))
  })

  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/bounty.js
git commit -m "feat(vault): add bounty board API endpoint"
```

---

## Chunk 2: Frontend Service + Tab Wiring

### Task 4: Frontend API Service

**Files:**
- Modify: `src/services/database.js`

**Reference:**
- `src/services/database.js:1098-1114` — `marketplaceService` pattern

- [ ] **Step 1: Add `bountyService` to `src/services/database.js`**

Add after the `marketplaceService` export (around line 1114):

```javascript
export const bountyService = {
    async list(params = {}) {
        return apiCall('bounty', { action: 'list', ...params })
    },
    async myBounties() {
        return apiCall('bounty', { action: 'my-bounties' })
    },
    async fulfillable() {
        return apiCall('bounty', { action: 'fulfillable' })
    },
    async hero() {
        return apiCall('bounty', { action: 'hero' })
    },
    async create(data) {
        return apiPost('bounty', { action: 'create' }, data)
    },
    async fulfill(data) {
        return apiPost('bounty', { action: 'fulfill' }, data)
    },
    async cancel(bountyId) {
        return apiPost('bounty', { action: 'cancel' }, { bountyId })
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add bountyService API client"
```

---

### Task 5: Vault Tab Wiring

**Files:**
- Modify: `src/pages/VaultPage.jsx`

**Reference:**
- `src/pages/VaultPage.jsx:1-59` — lazy imports, TABS array, TAB_COMPONENTS

- [ ] **Step 1: Add lazy import for CCBountyBoard**

Add after line 27 (after `const CCBinder`):

```javascript
const CCBountyBoard = lazy(() => import('./vault/CCBountyBoard'))
```

- [ ] **Step 2: Add bounty tab to TABS array**

Add after the `market` entry (line 37) and before `dismantle`:

```javascript
    { key: 'bounty', label: 'Bounties', icon: Crosshair, authOnly: true },
```

Also add `Crosshair` to the lucide-react import on line 9.

- [ ] **Step 3: Add to TAB_COMPONENTS**

Add inside the `TAB_COMPONENTS` object:

```javascript
    bounty: CCBountyBoard,
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/VaultPage.jsx
git commit -m "feat(vault): wire bounty board tab into VaultPage"
```

---

## Chunk 3: WantedPoster Component

### Task 6: WantedPoster Component

**Files:**
- Create: `src/pages/vault/components/WantedPoster.jsx`

**Reference:**
- `src/data/vault/economy.js` — `RARITIES` for rarity colors
- Design spec "Wanted Poster Design" section — taped mugshot, neon pin, western serif
- `functions/lib/vault-data.js` — god image URL pattern: `https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods/{imageKey}/Default/t_GodCard_{imageKey}.png`

This component renders one wanted poster. It does NOT display a full card — it shows the card's artwork as a cropped mugshot portrait.

**Props:**
- `bounty` — `{ id, card_type, card_name, rarity, holo_type, core_reward, created_at, expires_at }`
- `size` — `'lg'` (hero pinboard) or `'sm'` (grid) — defaults `'sm'`
- `canFulfill` — boolean, shows "Turn In" button
- `onFulfill` — callback `(bountyId) => void`
- `isMine` — boolean, shows "Cancel" button
- `onCancel` — callback `(bountyId) => void`

**Image resolution for mugshot:**
- God cards: use `getGodImageUrl` pattern — needs the god's `imageKey`. Import god data on the frontend from `src/data/vault/gods.js` to look up imageKey by name.
- Player cards: use a generic player silhouette or the card_name's avatar (not available in bounty data — use a fallback).
- Item/consumable cards: similar fallback approach.

For simplicity, import the frontend god list to resolve god images. For player/item/consumable, use a placeholder silhouette.

- [ ] **Step 1: Create the WantedPoster component**

```jsx
import { RARITIES } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'

const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75'
const GOD_MAP = Object.fromEntries(GODS.map(g => [g.name, g]))
const HOLO_LABELS = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }

function getPortraitUrl(bounty) {
  if (bounty.card_type === 'god') {
    const god = GOD_MAP[bounty.card_name]
    if (god) return `${GOD_CDN}/Gods/${god.imageKey}/Default/t_GodCard_${god.imageKey}.png`
  }
  return null // fallback handled in component
}

// Deterministic pseudo-random rotation from bounty id
function getPosterRotation(id) {
  const seed = ((id * 2654435761) >>> 0) % 1000
  return ((seed / 1000) * 4 - 2).toFixed(1) // -2 to +2 degrees
}

export default function WantedPoster({ bounty, size = 'sm', canFulfill, onFulfill, isMine, onCancel }) {
  const rarityInfo = RARITIES[bounty.rarity] || RARITIES.common
  const portrait = getPortraitUrl(bounty)
  const isLarge = size === 'lg'
  const rotation = getPosterRotation(bounty.id)

  const daysLeft = Math.max(0, Math.ceil((new Date(bounty.expires_at) - Date.now()) / 86400000))

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: isLarge ? 200 : 160,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Poster body */}
      <div
        className="rounded relative overflow-hidden"
        style={{
          background: 'rgba(20, 15, 8, 0.92)',
          border: '1px solid rgba(255, 140, 0, 0.27)',
          boxShadow: '0 0 24px rgba(255,140,0,0.1), inset 0 0 40px rgba(255,140,0,0.04)',
          padding: isLarge ? '18px 20px 14px' : '14px 16px 10px',
        }}
      >
        {/* Neon pin */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            top: -6, width: 12, height: 12,
            background: '#ff8c00',
            boxShadow: '0 0 10px rgba(255,140,0,0.6)',
          }}
        />

        <div className="text-center">
          {/* WANTED header */}
          <div
            className="font-bold border-b pb-1.5 mb-3"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: isLarge ? 20 : 16,
              letterSpacing: '0.4em',
              color: '#ff8c00',
              textShadow: '0 0 12px rgba(255,140,0,0.3)',
              borderColor: 'rgba(255,140,0,0.2)',
            }}
          >
            WANTED
          </div>

          {/* Taped mugshot */}
          <div className="relative mx-auto mb-2.5" style={{ width: isLarge ? 120 : 96, height: isLarge ? 110 : 88 }}>
            {/* Tape strips */}
            <div className="absolute top-[-3px] left-2 w-7 h-1.5 rounded-sm" style={{ background: 'rgba(255,200,100,0.15)', transform: 'rotate(-3deg)' }} />
            <div className="absolute top-[-3px] right-2 w-7 h-1.5 rounded-sm" style={{ background: 'rgba(255,200,100,0.15)', transform: 'rotate(2deg)' }} />

            <div
              className="w-full h-full rounded-sm overflow-hidden relative"
              style={{
                border: '2px solid #1a150e',
                boxShadow: '2px 3px 10px rgba(0,0,0,0.6)',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              }}
            >
              {portrait ? (
                <img
                  src={portrait}
                  alt={bounty.card_name}
                  className="w-full h-full object-cover object-top"
                  style={{ opacity: 0.85, filter: 'contrast(1.1) saturate(0.8)' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(255,140,0,0.3)' }}>
                  {bounty.card_type === 'player' ? '👤' : '?'}
                </div>
              )}
              {/* Vignette */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(255,200,100,0.05),transparent,rgba(0,0,0,0.2))' }} />
            </div>
          </div>

          {/* Card name */}
          <div className="font-bold text-white" style={{ fontSize: isLarge ? 13 : 11, letterSpacing: '0.05em' }}>
            {bounty.card_name.toUpperCase()}
          </div>

          {/* Rarity badge */}
          <div
            className="inline-block mt-1 px-2.5 py-0.5 rounded-sm text-[10px] font-bold tracking-widest"
            style={{
              color: rarityInfo.color,
              border: `1px solid ${rarityInfo.color}44`,
              background: `${rarityInfo.color}10`,
            }}
          >
            {rarityInfo.name.toUpperCase()}
          </div>

          {/* Holo + type label */}
          <div className="mt-1 text-[10px]" style={{ color: '#7a8a9a' }}>
            {bounty.holo_type ? `${HOLO_LABELS[bounty.holo_type] || bounty.holo_type} · ` : ''}
            {bounty.card_type.charAt(0).toUpperCase() + bounty.card_type.slice(1)} Card
          </div>

          {/* Reward */}
          <div className="mt-2.5 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
            <div className="text-[9px] tracking-[0.2em]" style={{ color: '#7a8a9a', fontFamily: "'Share Tech Mono', monospace" }}>
              REWARD
            </div>
            <div
              className="font-bold"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: isLarge ? 22 : 18,
                color: '#ff8c00',
                textShadow: '0 0 12px rgba(255,140,0,0.3)',
              }}
            >
              {bounty.core_reward} Core{bounty.core_reward !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Expiry */}
          <div className="mt-1 text-[9px]" style={{ color: daysLeft <= 2 ? '#ef4444' : '#5a6a7a' }}>
            {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
          </div>

          {/* Action buttons */}
          {canFulfill && onFulfill && (
            <button
              onClick={(e) => { e.stopPropagation(); onFulfill(bounty.id) }}
              className="mt-2 w-full py-1.5 rounded text-xs font-bold tracking-wide"
              style={{ background: 'rgba(0,229,255,0.15)', color: '#00e5ff', border: '1px solid rgba(0,229,255,0.3)' }}
            >
              TURN IN
            </button>
          )}
          {isMine && onCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(bounty.id) }}
              className="mt-2 w-full py-1.5 rounded text-xs font-bold tracking-wide"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              CANCEL (25% fee)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify god data import works**

Check that `src/data/vault/gods.js` exports a `GODS` array with `name` and `imageKey` fields. This is the frontend mirror of `functions/lib/vault-data.js`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/components/WantedPoster.jsx
git commit -m "feat(vault): add WantedPoster component with cyber-western design"
```

---

## Chunk 4: Bounty Board Sub-Components

### Task 7: HeroPinboard Component

**Files:**
- Create: `src/pages/vault/bounty/HeroPinboard.jsx`

- [ ] **Step 1: Create the HeroPinboard component**

```jsx
import WantedPoster from '../components/WantedPoster'

export default function HeroPinboard({ bounties, fulfillableIds, onFulfill }) {
  if (!bounties || bounties.length === 0) return null

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="text-center mb-5">
        <h2
          className="font-bold tracking-[0.3em]"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            color: '#ff8c00',
            textShadow: '0 0 20px rgba(255,140,0,0.4), 0 0 40px rgba(255,140,0,0.2)',
          }}
        >
          MOST WANTED
        </h2>
        <div className="text-[11px] tracking-[0.15em] mt-1" style={{ color: '#7a8a9a', fontFamily: "'Share Tech Mono', monospace" }}>
          HIGHEST BOUNTIES ON THE BOARD
        </div>
      </div>

      {/* Scattered poster layout with vertical stagger */}
      <div className="flex flex-wrap justify-center gap-6 px-4 items-start">
        {bounties.map((b, i) => (
          <div key={b.id} style={{ marginTop: [0, 16, 6, 22, 10][i % 5] }}>
          <WantedPoster
            key={b.id}
            bounty={b}
            size="lg"
            canFulfill={fulfillableIds?.includes(b.id)}
            onFulfill={onFulfill}
          />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/bounty/HeroPinboard.jsx
git commit -m "feat(vault): add HeroPinboard component for top bounties"
```

---

### Task 8: BountyGrid Component

**Files:**
- Create: `src/pages/vault/bounty/BountyGrid.jsx`

**Reference:**
- `src/pages/vault/CCMarketplace.jsx` — filter bar and pagination patterns

- [ ] **Step 1: Create the BountyGrid component**

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RARITIES } from '../../../data/vault/economy'
import WantedPoster from '../components/WantedPoster'

const CARD_TYPES = ['god', 'player', 'item', 'consumable']
const HOLO_TYPES = ['holo', 'reverse', 'full']
const HOLO_LABELS = { holo: 'Holo', reverse: 'Reverse', full: 'Full Art' }
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'reward_desc', label: 'Reward: High to Low' },
  { value: 'reward_asc', label: 'Reward: Low to High' },
  { value: 'expiring', label: 'Expiring Soon' },
]
const PAGE_SIZE = 24

export default function BountyGrid({
  bounties, total, page, setPage,
  filters, setFilters, sort, setSort,
  fulfillableIds, myBountyIds,
  onFulfill, onCancel,
  showFulfillable, setShowFulfillable,
  showMine, setShowMine,
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const toggleFilter = (key, value) => {
    setFilters(prev => {
      const current = prev[key] ? prev[key].split(',') : []
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, [key]: next.length ? next.join(',') : undefined }
    })
    setPage(0)
  }

  const clearFilters = () => {
    setFilters({})
    setShowFulfillable(false)
    setShowMine(false)
    setPage(0)
  }

  const activeRarities = filters.rarity ? filters.rarity.split(',') : []
  const activeTypes = filters.cardType ? filters.cardType.split(',') : []
  const activeHolos = filters.holoType ? filters.holoType.split(',') : []

  return (
    <div>
      {/* Filter bar */}
      <div className="space-y-2.5 mb-5">
        {/* Quick filters + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowFulfillable(!showFulfillable); setPage(0) }}
            className={`text-xs px-3 py-1.5 rounded border font-bold tracking-wide ${showFulfillable ? 'border-current bg-current/10' : 'border-white/10 text-white/30 hover:text-white/50'}`}
            style={showFulfillable ? { color: '#00e5ff' } : undefined}
          >
            Can Turn In
          </button>
          <button
            onClick={() => { setShowMine(!showMine); setPage(0) }}
            className={`text-xs px-3 py-1.5 rounded border font-bold tracking-wide ${showMine ? 'border-current bg-current/10' : 'border-white/10 text-white/30 hover:text-white/50'}`}
            style={showMine ? { color: '#ff8c00' } : undefined}
          >
            My Bounties
          </button>
          <div className="ml-auto">
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(0) }}
              className="text-xs bg-[var(--cd-surface)] border border-[var(--cd-border)] text-[var(--cd-text)] rounded px-2 py-1.5"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Rarity */}
        <div className="flex flex-wrap gap-1.5">
          {RARITY_ORDER.map(r => {
            const info = RARITIES[r]
            const active = activeRarities.includes(r)
            return (
              <button
                key={r}
                onClick={() => toggleFilter('rarity', r)}
                className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border font-bold ${active ? 'border-current bg-current/10' : 'border-white/10 text-white/30 hover:text-white/50'}`}
                style={active ? { color: info.color } : undefined}
              >
                {info.name}
              </button>
            )
          })}
        </div>

        {/* Card type + holo */}
        <div className="flex flex-wrap gap-1.5">
          {CARD_TYPES.map(t => {
            const active = activeTypes.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleFilter('cardType', t)}
                className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border ${active ? 'border-[var(--cd-cyan)] bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]' : 'border-white/10 text-white/30 hover:text-white/50'}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            )
          })}
          <div className="w-px bg-white/10 mx-1" />
          {HOLO_TYPES.map(h => {
            const active = activeHolos.includes(h)
            return (
              <button
                key={h}
                onClick={() => toggleFilter('holoType', h)}
                className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border ${active ? 'border-[var(--cd-purple)] bg-[var(--cd-purple)]/10 text-[var(--cd-purple)]' : 'border-white/10 text-white/30 hover:text-white/50'}`}
              >
                {HOLO_LABELS[h]}
              </button>
            )
          })}

          {(activeRarities.length > 0 || activeTypes.length > 0 || activeHolos.length > 0 || showFulfillable || showMine) && (
            <button onClick={clearFilters} className="text-[10px] sm:text-xs px-2 text-white/40 hover:text-white/70 ml-1">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs mb-3" style={{ color: '#7a8a9a' }}>
        {total} bounti{total === 1 ? 'y' : 'es'} found
      </div>

      {/* Grid */}
      {bounties.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: '#5a6a7a' }}>
          No bounties found
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
          {bounties.map(b => (
            <WantedPoster
              key={b.id}
              bounty={b}
              size="sm"
              canFulfill={fulfillableIds?.includes(b.id)}
              onFulfill={onFulfill}
              isMine={myBountyIds?.includes(b.id)}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded disabled:opacity-20"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs" style={{ color: '#7a8a9a' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded disabled:opacity-20"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/bounty/BountyGrid.jsx
git commit -m "feat(vault): add BountyGrid with filters and pagination"
```

---

### Task 9: CreateBountyForm Component

**Files:**
- Create: `src/pages/vault/bounty/CreateBountyForm.jsx`

**Reference:**
- `src/data/vault/gods.js` — god names for autocomplete
- `src/data/vault/economy.js` — `RARITIES` for rarity options

- [ ] **Step 1: Create the CreateBountyForm component**

```jsx
import { useState, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { RARITIES } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import WantedPoster from '../components/WantedPoster'

const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'player', label: 'Player' },
  { value: 'item', label: 'Item' },
  { value: 'consumable', label: 'Consumable' },
]
const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const HOLO_OPTIONS = [
  { value: '', label: 'Any Holo' },
  { value: 'holo', label: 'Holo' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'full', label: 'Full Art' },
]
const GOD_NAMES = GODS.map(g => g.name).sort()

export default function CreateBountyForm({ onSubmit, onClose, emberBalance, activeBountyCount }) {
  const [cardType, setCardType] = useState('god')
  const [cardName, setCardName] = useState('')
  const [rarity, setRarity] = useState('rare')
  const [holoType, setHoloType] = useState('')
  const [coreReward, setCoreReward] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const filteredNames = useMemo(() => {
    if (cardType !== 'god') return []
    if (!nameSearch) return GOD_NAMES.slice(0, 20)
    const q = nameSearch.toLowerCase()
    return GOD_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 20)
  }, [cardType, nameSearch])

  const canSubmit = cardName.trim() && rarity && coreReward && parseInt(coreReward) >= 1 && parseInt(coreReward) <= 10000 && !submitting

  const previewBounty = {
    id: 0, card_type: cardType, card_name: cardName || '???',
    rarity, holo_type: holoType || null, core_reward: parseInt(coreReward) || 0,
    created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ cardType, cardName: cardName.trim(), rarity, holoType: holoType || null, coreReward: parseInt(coreReward) })
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to create bounty')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--cd-surface)', border: '1px solid var(--cd-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--cd-border)' }}>
          <h3
            className="font-bold tracking-[0.2em]"
            style={{ fontFamily: 'Georgia, serif', color: '#ff8c00', fontSize: 18 }}
          >
            POST A BOUNTY
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Card Type */}
          <div>
            <label className="text-[10px] tracking-widest mb-1.5 block" style={{ color: '#7a8a9a' }}>CARD TYPE</label>
            <div className="flex gap-2">
              {CARD_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setCardType(t.value); setCardName(''); setNameSearch('') }}
                  className={`text-xs px-3 py-1.5 rounded border ${cardType === t.value ? 'border-[#ff8c00] bg-[#ff8c00]/10 text-[#ff8c00]' : 'border-white/10 text-white/30'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card Name */}
          <div>
            <label className="text-[10px] tracking-widest mb-1.5 block" style={{ color: '#7a8a9a' }}>NAME</label>
            {cardType === 'god' ? (
              <div className="relative">
                <input
                  value={cardName || nameSearch}
                  onChange={e => { setNameSearch(e.target.value); setCardName('') }}
                  placeholder="Search gods..."
                  className="w-full text-sm bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white rounded px-3 py-2"
                />
                {nameSearch && !cardName && filteredNames.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded border" style={{ background: 'var(--cd-edge)', borderColor: 'var(--cd-border)' }}>
                    {filteredNames.map(n => (
                      <button
                        key={n}
                        onClick={() => { setCardName(n); setNameSearch('') }}
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-white/5 text-white/70"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder={`Enter ${cardType} name...`}
                className="w-full text-sm bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white rounded px-3 py-2"
              />
            )}
          </div>

          {/* Rarity */}
          <div>
            <label className="text-[10px] tracking-widest mb-1.5 block" style={{ color: '#7a8a9a' }}>RARITY</label>
            <div className="flex flex-wrap gap-1.5">
              {RARITY_OPTIONS.map(r => {
                const info = RARITIES[r]
                return (
                  <button
                    key={r}
                    onClick={() => setRarity(r)}
                    className={`text-[10px] sm:text-xs px-2.5 py-1 rounded border font-bold ${rarity === r ? 'border-current bg-current/10' : 'border-white/10 text-white/30'}`}
                    style={rarity === r ? { color: info.color } : undefined}
                  >
                    {info.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Holo Type */}
          <div>
            <label className="text-[10px] tracking-widest mb-1.5 block" style={{ color: '#7a8a9a' }}>HOLO TYPE</label>
            <div className="flex gap-2">
              {HOLO_OPTIONS.map(h => (
                <button
                  key={h.value}
                  onClick={() => setHoloType(h.value)}
                  className={`text-xs px-3 py-1.5 rounded border ${holoType === h.value ? 'border-[var(--cd-purple)] bg-[var(--cd-purple)]/10 text-[var(--cd-purple)]' : 'border-white/10 text-white/30'}`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Core Reward */}
          <div>
            <label className="text-[10px] tracking-widest mb-1.5 block" style={{ color: '#7a8a9a' }}>
              CORE REWARD <span className="text-white/20 normal-case tracking-normal">(balance: {emberBalance ?? '?'})</span>
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={coreReward}
              onChange={e => setCoreReward(e.target.value)}
              placeholder="1 - 10,000"
              className="w-full text-sm bg-[var(--cd-edge)] border border-[var(--cd-border)] text-white rounded px-3 py-2"
            />
            <div className="text-[10px] mt-1" style={{ color: '#5a6a7a' }}>
              Escrowed on posting. Cancel fee: 25%. Expires in 14 days (10% fee).
            </div>
          </div>

          {/* Preview */}
          {cardName && (
            <div>
              <label className="text-[10px] tracking-widest mb-2 block" style={{ color: '#7a8a9a' }}>PREVIEW</label>
              <div className="flex justify-center">
                <WantedPoster bounty={previewBounty} size="sm" />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || activeBountyCount >= 3}
            className="w-full py-2.5 rounded font-bold text-sm tracking-wide disabled:opacity-30"
            style={{ background: 'rgba(255,140,0,0.15)', color: '#ff8c00', border: '1px solid rgba(255,140,0,0.3)' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> :
              activeBountyCount >= 3 ? 'MAX BOUNTIES REACHED (3/3)' : 'POST BOUNTY'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/bounty/CreateBountyForm.jsx
git commit -m "feat(vault): add CreateBountyForm with poster preview"
```

---

## Chunk 5: Orchestrator + Integration

### Task 10: CCBountyBoard Orchestrator

**Files:**
- Create: `src/pages/vault/CCBountyBoard.jsx`

**Reference:**
- `src/pages/vault/CCMarketplace.jsx` — state management and data loading pattern
- `src/services/database.js` — `bountyService`

- [ ] **Step 1: Create the orchestrator component**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useVault } from './VaultContext'
import { bountyService } from '../../services/database'
import { Plus, Loader2 } from 'lucide-react'
import HeroPinboard from './bounty/HeroPinboard'
import BountyGrid from './bounty/BountyGrid'
import CreateBountyForm from './bounty/CreateBountyForm'

export default function CCBountyBoard() {
  const { user } = useAuth()
  const { collection, ember, refreshCollection } = useVault()

  // Data
  const [heroBounties, setHeroBounties] = useState([])
  const [bounties, setBounties] = useState([])
  const [total, setTotal] = useState(0)
  const [myBountyIds, setMyBountyIds] = useState([])
  const [fulfillableIds, setFulfillableIds] = useState([])
  const [activeBountyCount, setActiveBountyCount] = useState(0)

  // UI
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('newest')
  const [filters, setFilters] = useState({})
  const [showFulfillable, setShowFulfillable] = useState(false)
  const [showMine, setShowMine] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadHero = useCallback(async () => {
    try {
      const res = await bountyService.hero()
      setHeroBounties(res.bounties || [])
    } catch (e) { console.error('hero load error:', e) }
  }, [])

  const loadBounties = useCallback(async () => {
    try {
      const params = { page: String(page), sort, ...filters }
      const res = await bountyService.list(params)
      setBounties(res.bounties || [])
      setTotal(res.total || 0)
    } catch (e) { console.error('bounty list error:', e) }
  }, [page, sort, filters])

  const loadFulfillable = useCallback(async () => {
    if (!user) return
    try {
      const res = await bountyService.fulfillable()
      setFulfillableIds(res.fulfillableIds || [])
    } catch (e) { console.error('fulfillable error:', e) }
  }, [user])

  const loadMyBounties = useCallback(async () => {
    if (!user) return
    try {
      const res = await bountyService.myBounties()
      const mine = res.bounties || []
      setMyBountyIds(mine.filter(b => b.status === 'active').map(b => b.id))
      setActiveBountyCount(mine.filter(b => b.status === 'active').length)
    } catch (e) { console.error('my bounties error:', e) }
  }, [user])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadHero(), loadBounties(), loadFulfillable(), loadMyBounties()])
    setLoading(false)
  }, [loadHero, loadBounties, loadFulfillable, loadMyBounties])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadBounties() }, [loadBounties])

  const handleCreate = async (data) => {
    const res = await bountyService.create(data)
    if (res.error) throw new Error(res.error)
    await loadAll()
    refreshCollection?.()
  }

  const handleFulfill = async (bountyId) => {
    const bounty = [...heroBounties, ...bounties].find(b => b.id === bountyId)
    if (!bounty) return

    // Find a matching card from user's collection
    const match = collection.find(c =>
      c.cardType === bounty.card_type &&
      c.godName === bounty.card_name &&
      c.rarity === bounty.rarity &&
      (!bounty.holo_type || c.holoType === bounty.holo_type)
    )
    if (!match) {
      alert('No matching unlocked card found in your collection')
      return
    }

    if (!window.confirm(`Turn in your ${bounty.rarity} ${bounty.card_name} card for ${bounty.core_reward} Cores?`)) return

    try {
      const res = await bountyService.fulfill({ bountyId, cardId: match.id })
      if (res.error) throw new Error(res.error)
      await loadAll()
      refreshCollection?.()
    } catch (e) {
      alert(e.message || 'Failed to fulfill bounty — card may be locked in a trade, lineup, binder, or listing')
    }
  }

  const handleCancel = async (bountyId) => {
    if (!window.confirm('Cancel this bounty? You will lose 25% of the escrowed Cores.')) return
    try {
      const res = await bountyService.cancel(bountyId)
      if (res.error) throw new Error(res.error)
      await loadAll()
      refreshCollection?.()
    } catch (e) {
      alert(e.message || 'Failed to cancel bounty')
    }
  }

  // Client-side filtering for quick filters
  let displayBounties = bounties
  if (showFulfillable) {
    displayBounties = displayBounties.filter(b => fulfillableIds.includes(b.id))
  }
  if (showMine) {
    displayBounties = displayBounties.filter(b => myBountyIds.includes(b.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: '#ff8c00' }} />
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* Post bounty button */}
      {user && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowCreate(true)}
            disabled={activeBountyCount >= 3}
            className="flex items-center gap-1.5 text-xs font-bold tracking-wide px-4 py-2 rounded disabled:opacity-30"
            style={{ background: 'rgba(255,140,0,0.15)', color: '#ff8c00', border: '1px solid rgba(255,140,0,0.3)' }}
          >
            <Plus size={14} />
            POST BOUNTY ({activeBountyCount}/3)
          </button>
        </div>
      )}

      {/* Hero pinboard */}
      <HeroPinboard
        bounties={heroBounties}
        fulfillableIds={fulfillableIds}
        onFulfill={handleFulfill}
      />

      {/* Divider */}
      {heroBounties.length > 0 && (
        <div className="border-t my-6" style={{ borderColor: 'rgba(255,140,0,0.1)' }} />
      )}

      {/* Main grid */}
      <BountyGrid
        bounties={displayBounties}
        total={showFulfillable || showMine ? displayBounties.length : total}
        page={page}
        setPage={setPage}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        setSort={setSort}
        fulfillableIds={fulfillableIds}
        myBountyIds={myBountyIds}
        onFulfill={handleFulfill}
        onCancel={handleCancel}
        showFulfillable={showFulfillable}
        setShowFulfillable={setShowFulfillable}
        showMine={showMine}
        setShowMine={setShowMine}
      />

      {/* Create modal */}
      {showCreate && (
        <CreateBountyForm
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          emberBalance={ember?.balance ?? ember}
          activeBountyCount={activeBountyCount}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCBountyBoard.jsx
git commit -m "feat(vault): add CCBountyBoard orchestrator component"
```

---

### Task 11: Verify and Fix Integration

- [ ] **Step 1: Verify the dev server starts**

```bash
npm run dev
```

Check the browser at `http://localhost:5173/vault?tab=bounty`. Verify the tab appears and loads without errors.

- [ ] **Step 2: Fix any import issues**

Common issues to check:
- `src/data/vault/gods.js` exports `GODS` array with `name` and `imageKey` fields
- `Crosshair` icon is available from `lucide-react` (if not, use `Target` or `CircleDot`)
- VaultContext's `ember` value returns the Core balance number

- [ ] **Step 3: Test the create flow**

1. Open the Bounty tab
2. Click "Post Bounty"
3. Fill in the form — select God, pick Zeus, Rare, any holo, 10 Cores
4. Verify the preview poster renders
5. Submit and verify the bounty appears in the grid

- [ ] **Step 4: Test the fulfill flow**

1. With a second account (or via impersonation), view the bounty board
2. Verify "Bounties I Can Turn In" filter works
3. Click "Turn In" on a matching bounty
4. Verify card transfers and Cores are awarded

- [ ] **Step 5: Test cancellation**

1. Post a bounty
2. Filter to "My Bounties"
3. Click "Cancel" — verify 75% refund

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(vault): bounty board integration fixes and polish"
```

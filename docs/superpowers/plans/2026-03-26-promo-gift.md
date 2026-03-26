# Promo Gift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner can gift a specific predetermined card to any user, delivered via a "Special Promo Gift Pack" auto-popup with full PackOpening animation.

**Architecture:** New `cc_promo_gifts` table stores pending gifts. New `trade_locked` column on `cc_cards` prevents trading promo-locked cards. Backend adds two vault actions (`send-promo-gift`, `claim-promo-gift`) plus a query in `handleLoad`. Frontend adds promo gift state to VaultContext, an auto-popup flow on VaultPage, and an admin form on VaultAdmin.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/146-promo-gifts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Promo gift packs: owner-to-user scripted card gifts
CREATE TABLE cc_promo_gifts (
  id SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  card_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  template_id INT REFERENCES cc_card_templates(id),
  card_config JSONB NOT NULL DEFAULT '{}',
  message TEXT,
  tradeable BOOLEAN NOT NULL DEFAULT true,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  card_id INT REFERENCES cc_cards(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_gifts_recipient ON cc_promo_gifts (recipient_id) WHERE claimed = false;

-- Trade lock column on cards
ALTER TABLE cc_cards ADD COLUMN trade_locked BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Run the migration against the dev database**

Run: `psql $DATABASE_URL -f database/migrations/146-promo-gifts.sql`
Expected: CREATE TABLE, CREATE INDEX, ALTER TABLE — no errors.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/146-promo-gifts.sql
git commit -m "feat(vault): add promo gifts table and trade_locked column"
```

---

### Task 2: Backend — Send Promo Gift Endpoint

**Files:**
- Modify: `functions/api/vault.js` (POST switch + new handler)

- [ ] **Step 1: Add the POST case to the switch block**

In the POST switch (around line 173), add before the `default` case:

```javascript
        case 'send-promo-gift': return await handleSendPromoGift(sql, user, body, event)
```

- [ ] **Step 2: Write the handler function**

Add at the end of the file (before `formatCard`):

```javascript
// ═══ POST: Send promo gift (owner only) ═══
async function handleSendPromoGift(sql, user, body, event) {
  // Owner = has permission_manage (top-level RBAC permission)
  const owner = await requirePermission(event, 'permission_manage')
  if (!owner) return { statusCode: 403, adminHeaders(event), body: JSON.stringify({ error: 'Owner only' }) }

  const { recipientId, cardType, rarity, templateId, cardConfig, message, tradeable = true } = body
  if (!recipientId) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'recipientId required' }) }
  if (!cardType) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'cardType required' }) }
  if (!rarity) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'rarity required' }) }
  if (!cardConfig || typeof cardConfig !== 'object') return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'cardConfig required' }) }

  const validTypes = ['god', 'item', 'player', 'collection', 'staff', 'custom', 'consumable', 'minion', 'buff']
  if (!validTypes.includes(cardType)) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'Invalid cardType' }) }

  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique', 'full_art']
  if (!validRarities.includes(rarity)) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'Invalid rarity' }) }

  // Verify recipient exists
  const [recipient] = await sql`SELECT id FROM users WHERE id = ${recipientId}`
  if (!recipient) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'Recipient not found' }) }

  // For collection cards, verify template exists and is approved
  if (cardType === 'collection') {
    if (!templateId) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'templateId required for collection cards' }) }
    const [template] = await sql`SELECT id FROM cc_card_templates WHERE id = ${templateId} AND status = 'approved'`
    if (!template) return { statusCode: 400, headers: adminHeaders(event), body: JSON.stringify({ error: 'Template not found or not approved' }) }
  }

  const trimmedMsg = message ? String(message).trim().slice(0, 500) : null

  const [gift] = await sql`
    INSERT INTO cc_promo_gifts (recipient_id, card_type, rarity, template_id, card_config, message, tradeable, created_by)
    VALUES (${recipientId}, ${cardType}, ${rarity}, ${templateId || null}, ${JSON.stringify(cardConfig)}, ${trimmedMsg}, ${tradeable !== false}, ${user.id})
    RETURNING id
  `

  return {
    statusCode: 200, headers: adminHeaders(event),
    body: JSON.stringify({ success: true, giftId: gift.id }),
  }
}
```

- [ ] **Step 3: Verify the import for `adminHeaders` is already available**

`adminHeaders` is a lazy getter already defined in `functions/lib/db.js` and used throughout `vault.js`. Confirm it's imported at the top of the file — it should be via the existing `import { ... adminHeaders } from '../lib/db.js'` or equivalent pattern. If `adminHeaders` is a function (takes `event`), use `adminHeaders(event)`. If it's a plain object, use `adminHeaders`.

Check the existing pattern in vault.js (e.g., `handleAdminRedeemCodes` or `handleBlackMarketDebugPending`) to match the exact calling convention.

- [ ] **Step 4: Test manually**

```bash
curl -X POST http://localhost:8788/api/vault?action=send-promo-gift \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientId":"TEST_USER_ID","cardType":"god","rarity":"legendary","cardConfig":{"god_id":"smite-thor","god_name":"Thor","god_class":"Assassin","role":"jungle"}}'
```

Expected: `{ "success": true, "giftId": 1 }`

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add send-promo-gift endpoint (owner only)"
```

---

### Task 3: Backend — Claim Promo Gift Endpoint

**Files:**
- Modify: `functions/api/vault.js` (POST switch + new handler)
- Modify: `functions/lib/vault.js` (import `rollHoloEffect`, `rollHoloType` if not already exported)

- [ ] **Step 1: Add the POST case to the switch block**

In the POST switch, add after `send-promo-gift`:

```javascript
        case 'claim-promo-gift': return await handleClaimPromoGift(sql, user, body)
```

- [ ] **Step 2: Write the handler function**

Add after `handleSendPromoGift`:

```javascript
// ═══ POST: Claim promo gift ═══
async function handleClaimPromoGift(sql, user, body) {
  const { giftId } = body
  if (!giftId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'giftId required' }) }

  const [gift] = await sql`
    SELECT * FROM cc_promo_gifts
    WHERE id = ${giftId} AND recipient_id = ${user.id} AND claimed = false
  `
  if (!gift) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift not found or already claimed' }) }

  const config = typeof gift.card_config === 'string' ? JSON.parse(gift.card_config) : gift.card_config
  const holoEffect = rollHoloEffect(gift.rarity)
  const holoType = rollHoloType(gift.rarity)
  const serialNumber = Math.floor(Math.random() * 9999) + 1

  // First edition check (for collection and player cards)
  let isFirstEdition = false
  if (gift.template_id) {
    const [existing] = await sql`
      SELECT 1 FROM cc_cards WHERE template_id = ${gift.template_id} AND rarity = ${gift.rarity} LIMIT 1
    `
    isFirstEdition = !existing
  } else if (gift.card_type === 'player' && config.def_id) {
    const [existing] = await sql`
      SELECT 1 FROM cc_cards WHERE def_id = ${config.def_id} AND rarity = ${gift.rarity} LIMIT 1
    `
    isFirstEdition = !existing
  }

  const [card] = await sql`
    INSERT INTO cc_cards (
      owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
      serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
      card_data, def_id, template_id, is_first_edition, depicted_user_id, trade_locked
    ) VALUES (
      ${user.id}, ${user.id}, ${config.god_id || null}, ${config.god_name || null},
      ${config.god_class || null}, ${config.role || null}, ${gift.rarity},
      ${serialNumber}, ${holoEffect}, ${holoType},
      ${config.image_url || null}, 'gift', ${gift.card_type},
      ${JSON.stringify(config.card_data || {})}, ${config.def_id || null},
      ${gift.template_id || null}, ${isFirstEdition},
      ${config.depicted_user_id || null}, ${!gift.tradeable}
    )
    RETURNING *
  `

  await sql`
    UPDATE cc_promo_gifts
    SET claimed = true, claimed_at = NOW(), card_id = ${card.id}
    WHERE id = ${giftId}
  `

  const formatted = [formatCard(card)]
  await inlineTemplateData(sql, formatted)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      card: formatted[0],
      packName: 'Special Promo Gift Pack',
      message: gift.message,
    }),
  }
}
```

- [ ] **Step 3: Ensure `rollHoloEffect` and `rollHoloType` are exported from `functions/lib/vault.js`**

Check if these functions are already exported. If not, add them to the export list:

```javascript
export { rollHoloEffect, rollHoloType }
```

Then import them at the top of `vault.js`:

```javascript
import { rollHoloEffect, rollHoloType, inlineTemplateData } from '../lib/vault.js'
```

Check which of these are already imported and only add what's missing.

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js functions/lib/vault.js
git commit -m "feat(vault): add claim-promo-gift endpoint"
```

---

### Task 4: Backend — Load Promo Gifts in handleLoad

**Files:**
- Modify: `functions/api/vault.js` (`handleLoad` function)

- [ ] **Step 1: Add promo gifts query to the Promise.all**

In `handleLoad` (line 195), add a new query to the `Promise.all` array. Add `promoGifts` to the destructured result:

Change the destructuring line to add `promoGifts` at the end:

```javascript
const [collection, stats, ember, packTypes, salePacks, tradeCount, matchTradeCount, inventory, _expired, lastVend, lockedCards, lockedPacks, pendingSignatures, rotationPacks, promoGifts] = await Promise.all([
```

Add this query at the end of the Promise.all array (after the rotation packs query):

```javascript
    sql`
      SELECT id, card_type, rarity, card_config, message, template_id, tradeable, created_at
      FROM cc_promo_gifts
      WHERE recipient_id = ${user.id} AND claimed = false
      ORDER BY created_at ASC
    `,
```

- [ ] **Step 2: Add promoGifts to the response body**

In the return object (around line 377, before the closing `}),`), add:

```javascript
      promoGifts: promoGifts.map(g => ({
        id: g.id,
        cardType: g.card_type,
        rarity: g.rarity,
        cardConfig: g.card_config,
        message: g.message,
        templateId: g.template_id,
        tradeable: g.tradeable,
        createdAt: g.created_at,
      })),
```

- [ ] **Step 3: Add `trade_locked` to `formatCard`**

In the `formatCard` function (line 2780), add after `templateId`:

```javascript
    tradeLocked: row.trade_locked || false,
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): include promoGifts in load response and tradeLocked in formatCard"
```

---

### Task 5: Backend — Trade Lock Enforcement

**Files:**
- Modify: `functions/lib/trading.js` (`addCard` function)
- Modify: `functions/lib/marketplace.js` (`createListing` function)

- [ ] **Step 1: Add trade_locked check to trading.js addCard**

In `addCard`, after the card ownership check (`if (card.owner_id !== userId) throw ...`), add:

```javascript
  if (card.trade_locked) throw new Error('This card is trade-locked and cannot be traded')
```

Also update the SELECT to include `trade_locked`:

```javascript
  const [card] = await tx`
    SELECT id, owner_id, trade_locked FROM cc_cards WHERE id = ${cardId} FOR UPDATE
  `
```

- [ ] **Step 2: Add trade_locked check to marketplace.js createListing**

In `createListing`, after the card ownership check (`if (card.owner_id !== userId) throw ...`), add:

```javascript
  if (card.trade_locked) throw new Error('This card is trade-locked and cannot be listed')
```

Also update the SELECT to include `trade_locked`:

```javascript
  const [card] = await sql`SELECT id, owner_id, trade_locked FROM cc_cards WHERE id = ${cardId}`
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/trading.js functions/lib/marketplace.js
git commit -m "feat(vault): enforce trade_locked in trading and marketplace"
```

---

### Task 6: Frontend — VaultContext Promo Gift State

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`
- Modify: `src/services/database.js` (add claimPromoGift service)

- [ ] **Step 1: Add claimPromoGift to vaultService in database.js**

Find the `vaultService` object in `src/services/database.js` (search for `const vaultService`). Add this method:

```javascript
  async claimPromoGift(giftId) {
    return apiPost('vault', { action: 'claim-promo-gift' }, { giftId })
  },
```

- [ ] **Step 2: Add promoGifts state to VaultContext**

After the existing `useState` calls (around line 54 in VaultContext.jsx), add:

```javascript
const [promoGifts, setPromoGifts] = useState([])
```

- [ ] **Step 3: Set promoGifts from load response**

In the load `useEffect` (around line 90), after `setRotationPacks(...)`, add:

```javascript
    setPromoGifts(ccData.promoGifts || [])
```

- [ ] **Step 4: Add claimPromoGift action**

After the existing `openGift` action, add:

```javascript
const claimPromoGift = useCallback(async (giftId) => {
  const result = await vaultService.claimPromoGift(giftId)
  setCollection(prev => [...prev, result.card])
  mergeInlineTemplates([result.card])
  setPromoGifts(prev => prev.filter(g => g.id !== giftId))
  return result
}, [mergeInlineTemplates])
```

- [ ] **Step 5: Expose in context value**

Add `promoGifts` and `claimPromoGift` to the context provider value object:

```javascript
promoGifts,
claimPromoGift,
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/VaultContext.jsx src/services/database.js
git commit -m "feat(vault): add promoGifts state and claimPromoGift action to VaultContext"
```

---

### Task 7: Frontend — Promo Gift Auto-Popup on VaultPage

**Files:**
- Modify: `src/pages/VaultPage.jsx`

- [ ] **Step 1: Import PackOpening and add state**

At the top of VaultPage.jsx, ensure `PackOpening` is imported (check existing imports — it may already be imported for pending reveal). If not:

```javascript
import PackOpening from './vault/components/PackOpening'
```

In `VaultInner`, add these state variables after the existing popup states:

```javascript
const { promoGifts, claimPromoGift } = useVault()
const [showPromoGift, setShowPromoGift] = useState(false)
const [promoGiftResult, setPromoGiftResult] = useState(null)
const [promoGiftClaiming, setPromoGiftClaiming] = useState(false)
```

- [ ] **Step 2: Add useEffect to trigger promo gift popup**

After the existing popup logic, add an effect that shows the promo gift popup when gifts are available:

```javascript
useEffect(() => {
  if (loaded && promoGifts.length > 0 && !promoGiftResult && !promoGiftClaiming) {
    setShowPromoGift(true)
  }
}, [loaded, promoGifts.length, promoGiftResult, promoGiftClaiming])
```

- [ ] **Step 3: Add the claim handler**

```javascript
const handleClaimPromoGift = useCallback(async () => {
  if (promoGifts.length === 0 || promoGiftClaiming) return
  setPromoGiftClaiming(true)
  try {
    const result = await claimPromoGift(promoGifts[0].id)
    setShowPromoGift(false)
    setPromoGiftResult(result)
  } catch (err) {
    console.error('Failed to claim promo gift:', err)
  } finally {
    setPromoGiftClaiming(false)
  }
}, [promoGifts, promoGiftClaiming, claimPromoGift])
```

- [ ] **Step 4: Render the promo gift modal and PackOpening**

Add before the existing tradematch promo popup (so it takes priority):

```jsx
{/* Promo Gift Available popup */}
{showPromoGift && promoGifts.length > 0 && !promoGiftResult && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div
      className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden p-8 text-center"
      style={{
        background: 'linear-gradient(135deg, var(--cd-surface) 0%, rgba(212,175,55,0.1) 100%)',
        border: '1px solid rgba(212,175,55,0.4)',
        boxShadow: '0 0 60px rgba(212,175,55,0.2)',
        animation: 'cd-fade-in 0.3s ease-out',
      }}
    >
      <div className="text-4xl mb-4">🎁</div>
      <h2 className="text-xl font-bold text-[#d4af37] mb-2">Special Promo Gift Pack</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-2">You've received a special gift!</p>
      {promoGifts[0].message && (
        <p className="text-sm text-[var(--color-text-primary)] italic mb-4 border-t border-[var(--cd-border)] pt-3 mt-3">
          "{promoGifts[0].message}"
        </p>
      )}
      <button
        onClick={handleClaimPromoGift}
        disabled={promoGiftClaiming}
        className="w-full py-3 rounded-xl font-bold text-black transition-all"
        style={{
          background: promoGiftClaiming ? '#888' : 'linear-gradient(135deg, #d4af37, #f0d060)',
          cursor: promoGiftClaiming ? 'wait' : 'pointer',
        }}
      >
        {promoGiftClaiming ? 'Opening...' : 'Open Gift'}
      </button>
    </div>
  </div>
)}

{/* Promo Gift Pack Opening animation */}
{promoGiftResult && (
  <PackOpening
    result={{
      packName: promoGiftResult.packName,
      cards: [promoGiftResult.card],
      packOpenId: null,
      packType: 'promo-gift',
    }}
    packType="promo-gift"
    onClose={() => {
      setPromoGiftResult(null)
      // Check for more promo gifts — the useEffect will re-trigger showPromoGift
    }}
    onOpenMore={null}
  />
)}
```

- [ ] **Step 5: Suppress other popups when promo gift is showing**

Update the tradematch promo and discord promo conditionals to also check `!showPromoGift && !promoGiftResult`. For the tradematch promo:

```jsx
{showTradematchPromo && user && activeTab !== 'tradematch' && !showPromoGift && !promoGiftResult && (
```

For the discord promo:

```jsx
{showDiscordPromo && !passionLoading && !inDiscord && user && !showTradematchPromo && !showPromoGift && !promoGiftResult && (
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/VaultPage.jsx
git commit -m "feat(vault): add promo gift auto-popup with PackOpening animation"
```

---

### Task 8: Frontend — Admin Promo Gift Form

**Files:**
- Create: `src/pages/admin/vault/CCAdminPromoGift.jsx`
- Modify: `src/pages/admin/VaultAdmin.jsx` (add tab)
- Modify: `src/services/database.js` (add sendPromoGift service)

- [ ] **Step 1: Add sendPromoGift to vaultDashboardService in database.js**

Find the `vaultDashboardService` object. Add:

```javascript
  async sendPromoGift(data) {
    return apiPost('vault', { action: 'send-promo-gift' }, data)
  },
```

- [ ] **Step 2: Create the admin promo gift component**

```jsx
import { useState, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { vaultDashboardService } from '../../../services/database'
import { RARITIES } from '../../../data/vault/economy'

const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'item', label: 'Item' },
  { value: 'player', label: 'Player' },
  { value: 'collection', label: 'Collection' },
  { value: 'staff', label: 'Staff' },
  { value: 'custom', label: 'Custom' },
]

const RARITY_OPTIONS = Object.entries(RARITIES)
  .filter(([key]) => key !== 'full_art')
  .map(([key, val]) => ({ value: key, label: val.name, color: val.color }))

export default function CCAdminPromoGift() {
  const { hasPermission } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [recipient, setRecipient] = useState(null)
  const [cardType, setCardType] = useState('god')
  const [rarity, setRarity] = useState('legendary')
  const [templateId, setTemplateId] = useState('')
  const [godName, setGodName] = useState('')
  const [godId, setGodId] = useState('')
  const [godClass, setGodClass] = useState('')
  const [role, setRole] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [message, setMessage] = useState('')
  const [tradeable, setTradeable] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (!hasPermission('permission_manage')) return null

  const searchUsers = useCallback(async (q) => {
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const data = await vaultDashboardService.searchUsers(q)
      setSearchResults(data.users || [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearch = useCallback((e) => {
    const q = e.target.value
    setSearchQuery(q)
    searchUsers(q)
  }, [searchUsers])

  const selectRecipient = useCallback((user) => {
    setRecipient(user)
    setSearchQuery('')
    setSearchResults([])
  }, [])

  const handleSend = useCallback(async () => {
    if (!recipient) return
    setSending(true)
    setError(null)
    setResult(null)

    const cardConfig = {}
    if (cardType === 'god' || cardType === 'item' || cardType === 'custom' || cardType === 'staff') {
      cardConfig.god_id = godId || godName.toLowerCase().replace(/\s+/g, '-')
      cardConfig.god_name = godName
      cardConfig.god_class = godClass
      cardConfig.role = role || null
      cardConfig.image_url = imageUrl || null
    } else if (cardType === 'player') {
      cardConfig.god_id = godId
      cardConfig.god_name = godName
      cardConfig.god_class = godClass
      cardConfig.role = role || null
      cardConfig.image_url = imageUrl || null
      cardConfig.card_data = {}
    } else if (cardType === 'collection') {
      cardConfig.god_id = `collection-${templateId}`
      cardConfig.god_name = godName
      cardConfig.god_class = cardType
      cardConfig.role = 'collection'
    }

    try {
      const data = await vaultDashboardService.sendPromoGift({
        recipientId: recipient.id,
        cardType,
        rarity,
        templateId: cardType === 'collection' ? Number(templateId) : null,
        cardConfig,
        message: message || null,
        tradeable,
      })
      setResult(`Gift sent! ID: ${data.giftId}`)
      setRecipient(null)
      setGodName('')
      setGodId('')
      setGodClass('')
      setRole('')
      setImageUrl('')
      setMessage('')
      setTemplateId('')
    } catch (err) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }, [recipient, cardType, rarity, templateId, godId, godName, godClass, role, imageUrl, message, tradeable])

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)] text-[var(--color-text-primary)] text-sm'
  const labelClass = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[var(--cd-cyan)]">Send Promo Gift</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Gift a specific card to a user. They'll receive it as a Special Promo Gift Pack.
      </p>

      {/* Recipient search */}
      <div>
        <label className={labelClass}>Recipient</label>
        {recipient ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)]">
            <span className="text-sm text-[var(--color-text-primary)]">{recipient.playerName || recipient.discordUsername}</span>
            <button onClick={() => setRecipient(null)} className="ml-auto text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text" value={searchQuery} onChange={handleSearch}
              placeholder="Search by username..." className={inputClass}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] max-h-48 overflow-y-auto">
                {searchResults.map(u => (
                  <button
                    key={u.id} onClick={() => selectRecipient(u)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--cd-hover)] text-[var(--color-text-primary)]"
                  >
                    {u.playerName || u.discordUsername}
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="text-xs text-[var(--color-text-secondary)] mt-1">Searching...</div>}
          </div>
        )}
      </div>

      {/* Card type */}
      <div>
        <label className={labelClass}>Card Type</label>
        <select value={cardType} onChange={e => setCardType(e.target.value)} className={inputClass}>
          {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Rarity */}
      <div>
        <label className={labelClass}>Rarity</label>
        <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setRarity(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                rarity === r.value ? 'ring-2 ring-white/40 scale-105' : 'opacity-60 hover:opacity-80'
              }`}
              style={{ borderColor: r.color, color: r.color, background: rarity === r.value ? `${r.color}20` : 'transparent' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card config — conditional fields */}
      {cardType === 'collection' ? (
        <div>
          <label className={labelClass}>Template ID</label>
          <input type="number" value={templateId} onChange={e => setTemplateId(e.target.value)} placeholder="Approved template ID" className={inputClass} />
          <label className={labelClass + ' mt-3'}>Card Name</label>
          <input type="text" value={godName} onChange={e => setGodName(e.target.value)} placeholder="Display name" className={inputClass} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={godName} onChange={e => setGodName(e.target.value)} placeholder="e.g. Thor" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ID / Slug</label>
            <input type="text" value={godId} onChange={e => setGodId(e.target.value)} placeholder="e.g. smite-thor" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <input type="text" value={godClass} onChange={e => setGodClass(e.target.value)} placeholder="e.g. Assassin" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
              <option value="">None</option>
              <option value="solo">Solo</option>
              <option value="jungle">Jungle</option>
              <option value="mid">Mid</option>
              <option value="support">Support</option>
              <option value="adc">ADC</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Image URL</label>
            <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
        </div>
      )}

      {/* Tradeable toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={tradeable} onChange={e => setTradeable(e.target.checked)} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
        <span className="text-sm text-[var(--color-text-primary)]">Tradeable</span>
      </div>

      {/* Message */}
      <div>
        <label className={labelClass}>Message (optional)</label>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Congrats on the tournament win!"
          rows={2} className={inputClass}
          maxLength={500}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!recipient || !godName || sending}
        className="px-6 py-2.5 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #d4af37, #f0d060)' }}
      >
        {sending ? 'Sending...' : 'Send Promo Gift'}
      </button>

      {result && <div className="text-sm text-green-400 font-medium">{result}</div>}
      {error && <div className="text-sm text-red-400 font-medium">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Add the tab to VaultAdmin**

In `src/pages/admin/VaultAdmin.jsx`, add the import:

```javascript
import CCAdminPromoGift from './vault/CCAdminPromoGift'
```

Add to the `TABS` array (at the end, before the closing `]`):

```javascript
  { key: 'promo-gift', label: 'Promo Gift', icon: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
```

Add the tab content render. Find the pattern where tabs are rendered (likely a switch or conditional). Add:

```javascript
{activeTab === 'promo-gift' && <CCAdminPromoGift />}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/vault/CCAdminPromoGift.jsx src/pages/admin/VaultAdmin.jsx src/services/database.js
git commit -m "feat(vault): add promo gift admin form on VaultAdmin page"
```

---

### Task 9: Frontend — Trade Lock UI

**Files:**
- Modify: `src/pages/vault/CCCollection.jsx` (or wherever card action buttons are rendered)
- Modify: `src/pages/vault/components/CardZoomModal.jsx` (show lock badge)

- [ ] **Step 1: Find where trade/list actions are rendered**

Search for where "List on Market" or "Add to Trade" buttons appear for a card. These are likely in `CardZoomModal.jsx` or a card action menu component. The `tradeLocked` property from `formatCard` is available on each card object.

- [ ] **Step 2: Add trade lock badge to CardZoomModal**

In CardZoomModal, near the card info area, add a conditional badge:

```jsx
{card.tradeLocked && (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-xs text-red-400 font-medium">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
    Trade Locked
  </div>
)}
```

- [ ] **Step 3: Disable trade/market buttons when trade locked**

Where listing and trade buttons are rendered, add `card.tradeLocked` to their disabled condition:

```jsx
disabled={card.tradeLocked || /* existing conditions */}
```

Add a tooltip or title attribute:

```jsx
title={card.tradeLocked ? 'This card is trade-locked' : ''}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/components/CardZoomModal.jsx
git commit -m "feat(vault): show trade-locked badge and disable trade actions for locked cards"
```

---

### Task 10: Manual Integration Test

- [ ] **Step 1: Start the dev server**

Run: `npm start`

- [ ] **Step 2: Test the admin send flow**

1. Log in as owner
2. Navigate to Vault Admin → Promo Gift tab
3. Search for a test user
4. Configure a god card (e.g., Thor, Legendary)
5. Toggle tradeable off
6. Add a message
7. Click Send — verify success response

- [ ] **Step 3: Test the recipient claim flow**

1. Log in as the test user (or impersonate)
2. Navigate to The Vault
3. Verify the "Special Promo Gift Pack" popup appears
4. Click Open Gift
5. Verify PackOpening animation plays with the single card
6. Verify card appears in collection with trade-locked badge
7. Verify the card cannot be listed on market or added to a trade

- [ ] **Step 4: Verify edge cases**

1. Refresh during popup — verify gift is still available (not claimed until opened)
2. Send a collection card — verify template data renders correctly
3. Send a tradeable card — verify no lock badge, can trade normally

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(vault): promo gift integration test fixes"
```

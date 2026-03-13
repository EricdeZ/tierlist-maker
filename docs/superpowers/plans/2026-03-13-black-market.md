# Black Market Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Black Market page to the Vault's packs section where users turn in Brudih player cards via a theatrical drag-to-hand animation in exchange for league-specific packs (or a mythic card of choice).

**Architecture:** New `black-market` mode in `PackShopRouter` (alongside my-packs/shop/sale). Backend adds two vault actions (`black-market-turn-in`, `black-market-claim-mythic`) to `functions/api/vault.js`. Two new columns on `cc_stats`. Frontend is a single lazy-loaded component `CCBlackMarket.jsx` with its own CSS file for the dark red theme override and 5-phase hand animation.

**Tech Stack:** React 19, Tailwind CSS 4, CSS animations/keyframes, inline SVG for the hand, HTML5 Drag & Drop API (desktop) + tap-to-confirm (mobile), Neon tagged template literals.

**Spec:** `docs/superpowers/specs/2026-03-13-black-market-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `functions/api/vault.js` | Modify | Add `black-market-turn-in` and `black-market-claim-mythic` action cases + handler functions; update `formatStats` to include new fields |
| `src/services/database.js` | Modify | Add `blackMarketTurnIn()` and `blackMarketClaimMythic()` to `vaultService` |
| `src/pages/vault/VaultContext.jsx` | Modify | Add `blackMarketTurnIn` and `blackMarketClaimMythic` callbacks; expose in context value |
| `src/pages/vault/CCPackShop.jsx` | Modify | Add `black-market` mode to `PackShopRouter` toggle bar + lazy import |
| `src/pages/vault/CCBlackMarket.jsx` | Create | Main Black Market component: card grid, drop zone, animation state machine, counters, mythic selection modal |
| `src/pages/vault/CCBlackMarket.css` | Create | Dark red theme override, hand SVG states, 5-phase animation keyframes, vignette, particles |

---

## Chunk 1: Backend — Database + API Handlers

### Task 1: Add cc_stats columns and update formatStats

**Files:**
- Modify: `functions/api/vault.js:1480-1486` (formatStats function)

- [ ] **Step 1: Add database columns**

Run the following SQL against the database (or add to a migration file if the project uses them):

```sql
ALTER TABLE cc_stats
  ADD COLUMN IF NOT EXISTS brudihs_turned_in INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_mythic_claim INTEGER DEFAULT 0;
```

- [ ] **Step 2: Update formatStats to include new fields**

In `functions/api/vault.js`, find the `formatStats` function at line 1480 and update:

```javascript
function formatStats(row) {
  if (!row) return { packsOpened: 0, embers: 0, brudihsTurnedIn: 0, pendingMythicClaim: 0 }
  return {
    packsOpened: row.packs_opened,
    embers: row.embers,
    brudihsTurnedIn: row.brudihs_turned_in || 0,
    pendingMythicClaim: row.pending_mythic_claim || 0,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add brudihs_turned_in and pending_mythic_claim to stats"
```

### Task 2: Add black-market-turn-in handler

**Files:**
- Modify: `functions/api/vault.js:57-78` (POST action switch) and add new handler function

- [ ] **Step 1: Add action case to POST switch**

In `functions/api/vault.js`, add two new cases in the POST switch block (after the `dismantle` case at line 65):

```javascript
case 'black-market-turn-in': return await handleBlackMarketTurnIn(sql, user, body)
case 'black-market-claim-mythic': return await handleBlackMarketClaimMythic(sql, user, body)
```

- [ ] **Step 2: Add reward mapping constant**

Add this near the top of the handler section (e.g., after `DISMANTLE_VALUES` around line 934):

```javascript
// ═══ POST: Black Market — turn in Brudih cards ═══
const BLACK_MARKET_REWARDS = {
  common: 3, uncommon: 5, rare: 7, epic: 10, legendary: 15,
}
```

- [ ] **Step 3: Implement handleBlackMarketTurnIn**

Add the handler function after the reward constant:

```javascript
async function handleBlackMarketTurnIn(sql, user, body) {
  const { cardId } = body
  if (!cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  }

  const result = await transaction(async (tx) => {
    // Fetch card + player def in one query, with lock guards
    const [card] = await tx`
      SELECT c.id, c.rarity, c.owner_id, d.player_name, d.league_id, l.slug AS league_slug
      FROM cc_cards c
      JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
      JOIN leagues l ON d.league_id = l.id
      WHERE c.id = ${cardId} AND c.owner_id = ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM cc_market_listings ml
          WHERE ml.card_id = c.id AND ml.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_trade_cards tc
          JOIN cc_trades t ON tc.trade_id = t.id
          WHERE tc.card_id = c.id AND t.status IN ('waiting', 'active')
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_lineups ln
          WHERE (ln.card_id = c.id OR ln.god_card_id = c.id OR ln.item_card_id = c.id) AND ln.user_id = ${user.id}
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_binder_cards bc WHERE bc.card_id = c.id
        )
    `
    if (!card) {
      throw new Error('Card not found, not a Brudih, or is locked (market/trade/lineup/binder)')
    }
    if (card.player_name !== 'Brudih') {
      throw new Error('Card is not a Brudih card')
    }

    // Check pending mythic claim
    await ensureStats(tx, user.id)
    const [userStats] = await tx`SELECT pending_mythic_claim FROM cc_stats WHERE user_id = ${user.id}`
    if (userStats.pending_mythic_claim > 0) {
      throw new Error('You must claim your pending mythic card first')
    }

    const isMythic = card.rarity === 'mythic'
    const rewardCount = BLACK_MARKET_REWARDS[card.rarity]
    if (!isMythic && !rewardCount) {
      throw new Error(`No reward defined for rarity: ${card.rarity}`)
    }

    // Determine league pack type
    const packTypeId = `${card.league_slug}-mixed`
    if (!isMythic) {
      const [packType] = await tx`SELECT id FROM cc_pack_types WHERE id = ${packTypeId} AND enabled = true`
      if (!packType) {
        throw new Error(`No pack type found for league: ${card.league_slug}`)
      }
    }

    // Clean up completed trade references (same as dismantle)
    await tx`
      DELETE FROM cc_trade_cards tc
      USING cc_trades t
      WHERE tc.trade_id = t.id AND tc.card_id = ${cardId}
        AND t.status NOT IN ('waiting', 'active')
    `

    // Delete the card
    await tx`DELETE FROM cc_cards WHERE id = ${cardId} AND owner_id = ${user.id}`

    // Grant reward
    if (isMythic) {
      await tx`
        UPDATE cc_stats SET
          brudihs_turned_in = brudihs_turned_in + 1,
          pending_mythic_claim = pending_mythic_claim + 1
        WHERE user_id = ${user.id}
      `
      return { type: 'mythic_choice' }
    } else {
      // Insert packs into inventory
      for (let i = 0; i < rewardCount; i++) {
        await tx`
          INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
          VALUES (${user.id}, ${packTypeId}, 'black-market')
        `
      }
      await tx`
        UPDATE cc_stats SET brudihs_turned_in = brudihs_turned_in + 1
        WHERE user_id = ${user.id}
      `
      return { type: 'packs', packType: packTypeId, count: rewardCount }
    }
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, reward: result }),
  }
}
```

**Error handling note:** The `transaction()` helper auto-rolls back on thrown errors. The outer try/catch in the main handler (line 83-86) catches and returns 500. For user-facing errors, the thrown message is returned as the error body since the outer catch does `error.message`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add black-market-turn-in API handler"
```

### Task 3: Add black-market-claim-mythic handler

**Files:**
- Modify: `functions/api/vault.js` (add handler function after the turn-in handler)

- [ ] **Step 1: Implement handleBlackMarketClaimMythic**

This handler creates a mythic card of the user's choice. It needs to import card generation helpers. Check the existing imports at the top of `functions/api/vault.js` (line 8) — `openPack` and `ensureStats` are already imported from `../lib/vault.js`. You'll need to also use the card creation pattern from `functions/lib/vault.js`.

Add the handler:

```javascript
async function handleBlackMarketClaimMythic(sql, user, body) {
  const { cardType, godId } = body
  if (!cardType || !godId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardType and godId required' }) }
  }

  const validTypes = ['god', 'item', 'consumable', 'player', 'minion']
  if (!validTypes.includes(cardType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid cardType: ${cardType}` }) }
  }

  const result = await transaction(async (tx) => {
    await ensureStats(tx, user.id)
    const [stats] = await tx`SELECT pending_mythic_claim FROM cc_stats WHERE user_id = ${user.id}`
    if (!stats || stats.pending_mythic_claim <= 0) {
      throw new Error('No pending mythic claim')
    }

    // Validate the card definition exists in the catalog
    // For player cards, verify def_id exists in cc_player_defs
    // For gods/items/consumables/minions, verify godId matches known data
    if (cardType === 'player') {
      if (!body.defId) throw new Error('defId required for player cards')
      const [def] = await tx`SELECT id FROM cc_player_defs WHERE id = ${body.defId}`
      if (!def) throw new Error('Player definition not found')
    } else {
      // For non-player types, validate godId format matches expectations
      // god: slug string, item: 'item-{id}', consumable: 'consumable-{id}', minion: 'minion-{id}'
      if (!godId || typeof godId !== 'string') throw new Error('Invalid godId')
    }

    // Create the mythic card — use the same serial/holo pattern as pack-generated cards
    const serialNumber = Math.floor(Math.random() * 9999) + 1
    const [card] = await tx`
      INSERT INTO cc_cards (
        owner_id, god_id, god_name, god_class, role, rarity,
        serial_number, holo_effect, holo_type, acquired_via, card_type,
        def_id
      )
      VALUES (
        ${user.id}, ${godId}, ${body.godName || ''}, ${body.godClass || ''},
        ${body.role || ''}, 'mythic',
        ${serialNumber}, 'rainbow', 'holo', 'black-market', ${cardType},
        ${cardType === 'player' ? (body.defId || null) : null}
      )
      RETURNING *
    `

    await tx`
      UPDATE cc_stats SET pending_mythic_claim = pending_mythic_claim - 1
      WHERE user_id = ${user.id}
    `

    return card
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, card: formatCard(result) }),
  }
}
```

**Note:** The frontend sends `godName`, `godClass`, `role`, and `defId` alongside `cardType` and `godId` since it has the full catalog data. Server validates player defs exist in the database, and validates godId format for other types.

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): add black-market-claim-mythic API handler"
```

---

## Chunk 2: Frontend Service + Context Layer

### Task 4: Add vaultService methods

**Files:**
- Modify: `src/services/database.js:1090-1096` (before closing brace of vaultService)

- [ ] **Step 1: Add two new methods to vaultService**

In `src/services/database.js`, add before the closing `}` of `vaultService` (line 1096):

```javascript
    blackMarketTurnIn(cardId) {
        return apiPost('vault', { action: 'black-market-turn-in' }, { cardId })
    },
    blackMarketClaimMythic(data) {
        return apiPost('vault', { action: 'black-market-claim-mythic' }, data)
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add blackMarketTurnIn and blackMarketClaimMythic service methods"
```

### Task 5: Add VaultContext callbacks

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx:195-289`

- [ ] **Step 1: Add blackMarketTurnIn callback**

Add after the `dismantleCards` callback (after line 200):

```javascript
  const blackMarketTurnIn = useCallback(async (cardId) => {
    const result = await vaultService.blackMarketTurnIn(cardId)
    // Remove the turned-in card from collection
    setCollection(prev => prev.filter(c => c.id !== cardId))
    // Update stats
    setStats(prev => ({
      ...prev,
      brudihsTurnedIn: (prev.brudihsTurnedIn || 0) + 1,
      pendingMythicClaim: result.reward?.type === 'mythic_choice'
        ? (prev.pendingMythicClaim || 0) + 1
        : prev.pendingMythicClaim,
    }))
    // If packs were granted, refresh inventory
    if (result.reward?.type === 'packs') {
      const loadResult = await vaultService.load()
      setInventory(loadResult.inventory || [])
    }
    return result
  }, [])
```

- [ ] **Step 2: Add blackMarketClaimMythic callback**

Add after the turn-in callback:

```javascript
  const blackMarketClaimMythic = useCallback(async (data) => {
    const result = await vaultService.blackMarketClaimMythic(data)
    // Add the new mythic card to collection
    if (result.card) {
      setCollection(prev => [result.card, ...prev])
    }
    // Decrement pending claim
    setStats(prev => ({
      ...prev,
      pendingMythicClaim: Math.max(0, (prev.pendingMythicClaim || 0) - 1),
    }))
    return result
  }, [])
```

- [ ] **Step 3: Expose in context value**

In the `VaultContext.Provider` value object (line 276-285), add the new callbacks. Add to the line with `dismantleCards`:

```javascript
buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection,
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(vault): add blackMarketTurnIn and blackMarketClaimMythic to VaultContext"
```

---

## Chunk 3: Frontend — PackShopRouter Integration + Black Market Component

### Task 6: Add black-market mode to PackShopRouter

**Files:**
- Modify: `src/pages/vault/CCPackShop.jsx:332-405`

- [ ] **Step 1: Add lazy import**

At the top of `CCPackShop.jsx`, add after the existing lazy import (line 11):

```javascript
const CCBlackMarket = lazy(() => import('./CCBlackMarket'));
```

- [ ] **Step 2: Add BLACK MARKET toggle button**

In the `PackShopRouter` component, find the desktop toggles `<div>` (line 354-393). Add a new button after the LIMITED SALE button (before the closing `</div>`):

```jsx
<button
  onClick={() => setMode('black-market')}
  className={`px-5 py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer relative ${
    mode === 'black-market'
      ? 'bg-red-900/20 text-red-500 border-red-500/30'
      : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
  }`}
  style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
>
  BLACK MARKET
  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
</button>
```

- [ ] **Step 3: Add black-market route to mode switch**

In the mode rendering section (lines 394-404), add the black-market case. Replace the ternary chain with:

```jsx
{mode === 'my-packs' ? (
  <MyPacks />
) : mode === 'shop' ? (
  <PackShop />
) : mode === 'black-market' ? (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
    <CCBlackMarket />
  </Suspense>
) : (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
    <CCPackSale />
  </Suspense>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/CCPackShop.jsx
git commit -m "feat(vault): add BLACK MARKET mode to PackShopRouter"
```

### Task 7: Create CCBlackMarket.css

**Files:**
- Create: `src/pages/vault/CCBlackMarket.css`

- [ ] **Step 1: Create the CSS file**

Create `src/pages/vault/CCBlackMarket.css` with the dark red theme override, hand SVG animation states, 5-phase keyframes, vignette, and shadow particles. Key sections:

1. **Theme container** — `.bm-container` with dark background, vignette overlay, red accent color vars
2. **Hand illustration** — `.bm-hand` SVG states for idle (open palm), grabbing (fist), and hidden (below fold). Use CSS transitions between states.
3. **Drop zone** — `.bm-drop-zone` with dashed border, pulsing glow on drag-over
4. **Card drag states** — `.bm-card-dragging` with lift shadow, tilt
5. **Animation phases** — `@keyframes bm-grab` (snap + close), `@keyframes bm-devour` (retreat into dark), `@keyframes bm-return` (emerge with reward), `@keyframes bm-screen-shake`
6. **Reward display** — `.bm-reward` fade-in, pack fan-out
7. **Particles** — `.bm-particle` floating shadow wisps with random drift
8. **Mobile overrides** — stacked layout, tap-to-confirm styling

This file will be substantial (~200-300 lines). The implementer should reference the existing `compdeck.css` and `PackOpening.css` for animation conventions used in the vault.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCBlackMarket.css
git commit -m "feat(vault): add Black Market CSS theme, hand animation, and keyframes"
```

### Task 8: Create CCBlackMarket.jsx — Core Structure

**Files:**
- Create: `src/pages/vault/CCBlackMarket.jsx`

This is the largest task. Build the component in layers:

- [ ] **Step 1: Create component skeleton with state**

Create `src/pages/vault/CCBlackMarket.jsx`:

```jsx
import { useState, useCallback, useMemo, useRef } from 'react'
import { useVault } from './VaultContext'
import { useAuth } from '../../context/AuthContext'
import './CCBlackMarket.css'

const REWARDS = {
  common: 3, uncommon: 5, rare: 7, epic: 10, legendary: 15,
}
const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

export default function CCBlackMarket() {
  const { user } = useAuth()
  const { collection, stats, blackMarketTurnIn, blackMarketClaimMythic, inventory } = useVault()

  // Animation state machine: 'idle' | 'dragging' | 'grab' | 'devour' | 'return' | 'collect'
  const [phase, setPhase] = useState('idle')
  const [selectedCard, setSelectedCard] = useState(null)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState(null)
  const [showMythicModal, setShowMythicModal] = useState(false)
  const dropZoneRef = useRef(null)

  // Filter collection to only Brudih player cards
  const brudihCards = useMemo(() =>
    collection.filter(c => c.cardType === 'player' && c.godName === 'Brudih')
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)),
    [collection]
  )

  const brudihsTurnedIn = stats?.brudihsTurnedIn || 0
  const brudihsHeld = brudihCards.length
  const pendingMythicClaim = stats?.pendingMythicClaim || 0

  // ... rest of component (subsequent steps)
}
```

**Key data note:** Cards in the collection have `cardType` and `godName` fields (set by `formatCard` in vault.js). Brudih cards have `cardType: 'player'` and `godName: 'Brudih'`. The card's league info comes from the card's `cardData` field which includes `leagueSlug`.

- [ ] **Step 2: Add the turn-in handler (animation state machine)**

Add inside the component, after the state declarations:

```jsx
  const handleTurnIn = useCallback(async (card) => {
    if (phase !== 'idle') return
    setSelectedCard(card)
    setError(null)

    // Phase 2: Grab
    setPhase('grab')
    await sleep(400)

    // Phase 3: Devour — fire API call during this phase
    setPhase('devour')
    try {
      const result = await blackMarketTurnIn(card.id)
      await sleep(600) // darkness pause after API returns

      // Phase 4: Return
      setReward(result.reward)
      setPhase('return')
      await sleep(800)

      // Phase 5: Collect
      setPhase('collect')
    } catch (err) {
      setError(err.message || 'Turn-in failed')
      setPhase('idle')
      setSelectedCard(null)
    }
  }, [phase, blackMarketTurnIn])

  const handleCollect = useCallback(() => {
    if (reward?.type === 'mythic_choice') {
      setShowMythicModal(true)
    }
    setPhase('idle')
    setSelectedCard(null)
    setReward(null)
  }, [reward])

  const handleMythicClaim = useCallback(async (cardData) => {
    try {
      await blackMarketClaimMythic(cardData)
      setShowMythicModal(false)
    } catch (err) {
      setError(err.message || 'Failed to claim mythic')
    }
  }, [blackMarketClaimMythic])
```

Add the sleep helper at the top of the file (outside the component):

```javascript
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
```

- [ ] **Step 3: Add desktop drag-and-drop handlers**

Add inside the component:

```jsx
  const handleDragStart = useCallback((e, card) => {
    if (phase !== 'idle') return
    e.dataTransfer.setData('text/plain', card.id)
    setSelectedCard(card)
    setPhase('dragging')
  }, [phase])

  const handleDragEnd = useCallback(() => {
    if (phase === 'dragging') {
      setPhase('idle')
      setSelectedCard(null)
    }
  }, [phase])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    if (selectedCard && phase === 'dragging') {
      handleTurnIn(selectedCard)
    }
  }, [selectedCard, phase, handleTurnIn])
```

- [ ] **Step 4: Add the JSX render**

Add the return JSX. This is the core layout with desktop (side-by-side) and mobile (stacked) responsive design:

```jsx
  return (
    <div className="bm-container relative">
      {/* Vignette overlay */}
      <div className="bm-vignette" />

      <div className="relative z-10">
        {/* Header + Counter */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="cd-head text-xl sm:text-2xl font-bold text-red-500 tracking-[0.3em] uppercase"
              style={{ textShadow: '0 0 20px rgba(255,0,0,0.3)' }}>
            The Black Market
          </h2>
          <div className="flex justify-center gap-4 mt-2">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-black text-red-500 font-mono">{brudihsTurnedIn}</div>
              <div className="text-[9px] text-white/30 tracking-widest">TURNED IN</div>
            </div>
            <div className="w-px bg-red-900/30" />
            <div className="text-center">
              <div className="text-lg sm:text-xl font-black text-white/50 font-mono">{brudihsHeld}</div>
              <div className="text-[9px] text-white/30 tracking-widest">IN COLLECTION</div>
            </div>
          </div>
        </div>

        {/* Pending mythic claim banner */}
        {pendingMythicClaim > 0 && phase === 'idle' && (
          <div className="mb-4 mx-auto max-w-md text-center">
            <button
              onClick={() => setShowMythicModal(true)}
              className="px-6 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 cd-head tracking-wider text-sm font-bold hover:bg-red-900/40 transition-colors cursor-pointer"
              style={{ animation: 'pulse 2s infinite' }}
            >
              Claim Your Mythic Card
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 mx-auto max-w-md text-center text-sm text-red-400 bg-red-900/20 rounded-lg px-4 py-2 border border-red-500/20">
            {error}
          </div>
        )}

        {/* Main layout — desktop: side-by-side, mobile: stacked */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
          {/* Cards section — order-2 on mobile (below hand), order-1 on desktop (left) */}
          <div className="order-2 sm:order-1">
            <BrudihCardGrid
              cards={brudihCards}
              phase={phase}
              selectedCard={selectedCard}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTapSelect={(card) => {
                // Mobile: tap to select
                if (phase === 'idle') {
                  setSelectedCard(prev => prev?.id === card.id ? null : card)
                }
              }}
            />
          </div>

          {/* Hand zone — order-1 on mobile (top), order-2 on desktop (right) */}
          <div className="order-1 sm:order-2">
            <HandDropZone
              ref={dropZoneRef}
              phase={phase}
              selectedCard={selectedCard}
              reward={reward}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onCollect={handleCollect}
              onMobileTurnIn={() => selectedCard && handleTurnIn(selectedCard)}
            />
          </div>
        </div>

        {/* Exchange rates — mobile only */}
        <ExchangeRates className="sm:hidden mt-6" />
      </div>

      {/* Mythic selection modal */}
      {showMythicModal && (
        <MythicSelectionModal
          onSelect={handleMythicClaim}
          onClose={() => setShowMythicModal(false)}
        />
      )}
    </div>
  )
```

- [ ] **Step 5: Commit skeleton**

```bash
git add src/pages/vault/CCBlackMarket.jsx src/pages/vault/CCBlackMarket.css
git commit -m "feat(vault): add CCBlackMarket component skeleton with state machine"
```

### Task 9: Build sub-components inside CCBlackMarket.jsx

**Files:**
- Modify: `src/pages/vault/CCBlackMarket.jsx`

Add the child components within the same file (they're small and tightly coupled to the parent):

- [ ] **Step 1: BrudihCardGrid component**

```jsx
function BrudihCardGrid({ cards, phase, selectedCard, onDragStart, onDragEnd, onTapSelect }) {
  if (cards.length === 0) {
    return (
      <div className="bm-panel rounded-xl p-6 text-center">
        <p className="text-white/30 cd-head tracking-wider text-sm">No Brudih cards in your collection</p>
        <p className="text-white/15 text-xs mt-1">Open packs to find Brudih player cards</p>
      </div>
    )
  }

  return (
    <div className="bm-panel rounded-xl p-3 sm:p-4">
      <div className="text-[10px] text-white/40 tracking-widest cd-head uppercase mb-3">
        Your Brudih Cards
      </div>
      {/* Desktop: grid, Mobile: horizontal scroll */}
      <div className="hidden sm:grid grid-cols-3 gap-2">
        {cards.map(card => (
          <BrudihCardItem
            key={card.id} card={card}
            isSelected={selectedCard?.id === card.id}
            disabled={phase !== 'idle' && phase !== 'dragging'}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onTapSelect(card)}
          />
        ))}
      </div>
      <div className="flex sm:hidden gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {cards.map(card => (
          <BrudihCardItem
            key={card.id} card={card}
            isSelected={selectedCard?.id === card.id}
            disabled={phase !== 'idle'}
            onClick={() => onTapSelect(card)}
            mobile
          />
        ))}
      </div>
      <div className="text-[9px] text-white/15 text-center mt-2 hidden sm:block">
        Drag a card to the hand →
      </div>
      <div className="text-[9px] text-white/15 text-center mt-2 sm:hidden">
        ↑ Tap a card, then tap Turn In
      </div>
    </div>
  )
}
```

- [ ] **Step 2: BrudihCardItem component**

```jsx
function BrudihCardItem({ card, isSelected, disabled, onDragStart, onDragEnd, onClick, mobile }) {
  const rarityColor = {
    common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6',
    epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444',
  }[card.rarity] || '#9ca3af'

  const rewardText = card.rarity === 'mythic'
    ? 'Mythic of choice'
    : `${REWARDS[card.rarity]} packs`

  return (
    <div
      draggable={!disabled && !mobile}
      onDragStart={onDragStart ? (e) => onDragStart(e, card) : undefined}
      onDragEnd={onDragEnd}
      onClick={disabled ? undefined : onClick}
      className={`${mobile ? 'w-20 min-w-[80px]' : ''} aspect-[2.5/3.5] rounded-md border flex flex-col items-center justify-center cursor-grab transition-all ${
        isSelected
          ? 'border-red-500/60 bg-red-900/20 scale-105 shadow-lg shadow-red-900/20'
          : 'border-red-900/30 bg-[#0a0a1e] hover:border-red-500/40'
      } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <div className="text-[8px] font-bold tracking-wider uppercase" style={{ color: rarityColor }}>
        {card.rarity}
      </div>
      <div className="text-[10px] text-white mt-0.5">Brudih</div>
      <div className="text-[8px] text-white/30 mt-0.5">{card.cardData?.leagueName?.toUpperCase() || ''}</div>
      {isSelected && (
        <div className="text-[7px] text-red-400 mt-1">{rewardText}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: HandDropZone component**

This is where the hand SVG lives and the animation phases play out. Use `forwardRef` for the drop zone ref:

```jsx
import { forwardRef } from 'react'

const HandDropZone = forwardRef(function HandDropZone(
  { phase, selectedCard, reward, onDragOver, onDrop, onCollect, onMobileTurnIn },
  ref
) {
  const isActive = phase === 'dragging' || (selectedCard && phase === 'idle')
  const rewardText = selectedCard
    ? selectedCard.rarity === 'mythic'
      ? 'Mythic card of your choice'
      : `${REWARDS[selectedCard.rarity]} ${selectedCard.cardData?.leagueName?.toUpperCase() || ''} Packs`
    : null

  return (
    <div
      ref={ref}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`bm-drop-zone rounded-xl relative overflow-hidden transition-all ${
        isActive ? 'bm-drop-zone-active' : ''
      } ${phase === 'grab' ? 'bm-phase-grab' : ''}
        ${phase === 'devour' ? 'bm-phase-devour' : ''}
        ${phase === 'return' ? 'bm-phase-return' : ''}
        ${phase === 'collect' ? 'bm-phase-collect' : ''}`}
      style={{ minHeight: 200 }}
    >
      {/* The Hand SVG — different states based on phase */}
      <div className={`bm-hand bm-hand-${phase}`}>
        <ShadowyHand phase={phase} />
      </div>

      {/* Reward preview (during drag/select) */}
      {isActive && rewardText && phase !== 'collect' && (
        <div className="absolute bottom-3 left-3 right-3 p-2 rounded-md bg-red-900/10 border border-red-900/20">
          <div className="text-[8px] text-white/25 tracking-widest uppercase">Reward</div>
          <div className="text-[10px] text-red-400 mt-0.5">{rewardText}</div>
        </div>
      )}

      {/* Collect state — show reward */}
      {phase === 'collect' && reward && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bm-reward-fade-in">
          <div className="text-sm font-bold text-red-500 cd-head tracking-wider mb-3">
            {reward.type === 'mythic_choice'
              ? 'Choose Your Mythic'
              : `${reward.count}× ${reward.packType?.toUpperCase()} Packs`}
          </div>
          <button
            onClick={onCollect}
            className="px-6 py-2 rounded-lg bg-red-900/40 border border-red-500/30 text-red-400 cd-head tracking-wider text-sm font-bold hover:bg-red-900/50 transition-colors cursor-pointer"
          >
            {reward.type === 'mythic_choice' ? 'CHOOSE YOUR MYTHIC' : 'COLLECT'}
          </button>
        </div>
      )}

      {/* Idle text */}
      {phase === 'idle' && !selectedCard && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <div className="text-[10px] text-red-500/30 tracking-widest cd-head uppercase">
            Drop a Brudih here...
          </div>
        </div>
      )}

      {/* Mobile: Turn In button when card is selected */}
      {phase === 'idle' && selectedCard && (
        <button
          onClick={onMobileTurnIn}
          className="absolute bottom-3 left-3 right-3 py-2.5 rounded-lg bg-red-900/40 border border-red-500/30 text-red-400 cd-head tracking-wider text-sm font-bold hover:bg-red-900/50 transition-colors cursor-pointer sm:hidden"
        >
          TURN IN
        </button>
      )}
    </div>
  )
})
```

- [ ] **Step 4: ShadowyHand SVG component**

Create an inline SVG of a reaching hand silhouette. This should be a dark silhouette with red ambient glow. The SVG has two states rendered via CSS classes: open palm (idle/dragging) and closed fist (grab/devour). The hand emerges from the bottom of the drop zone.

```jsx
function ShadowyHand({ phase }) {
  // Open palm for idle/dragging, fist for grab, hidden for devour, open for return
  const isFist = phase === 'grab' || phase === 'devour'

  return (
    <svg viewBox="0 0 200 300" className="bm-hand-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hand-glow" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="rgba(139,0,0,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="hand-shadow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {/* Ambient glow */}
      <ellipse cx="100" cy="240" rx="80" ry="60" fill="url(#hand-glow)" />
      {/* Hand silhouette — implementer should refine the path for best visual */}
      <g fill="#0a0008" stroke="rgba(139,0,0,0.2)" strokeWidth="0.5" filter="url(#hand-shadow)">
        {isFist ? (
          <path d="M70,280 L70,200 Q70,170 85,160 Q100,150 115,160 Q130,170 130,200 L130,280 Z" />
        ) : (
          <path d="M60,280 L60,200 L55,140 Q55,130 65,130 L70,130 Q75,130 75,140 L75,170 L80,120 Q80,110 90,110 L92,110 Q98,110 98,120 L95,170 L100,115 Q100,105 110,105 L112,105 Q118,105 118,115 L115,170 L118,125 Q118,115 128,115 L130,115 Q136,115 136,125 L130,200 L140,280 Z" />
        )}
      </g>
    </svg>
  )
}
```

**Note to implementer:** The SVG paths above are starting points. Refine the hand shape to look convincingly sinister — elongated fingers, slightly curled, emerging from shadow. The CSS handles the animation (translate, opacity, scale transitions between phases). Consider using multiple layered paths for depth (darker core, lighter edge).

- [ ] **Step 5: ExchangeRates and MythicSelectionModal components**

```jsx
function ExchangeRates({ className = '' }) {
  const rates = [
    { rarity: 'Common', color: '#9ca3af', reward: '3 packs' },
    { rarity: 'Uncommon', color: '#22c55e', reward: '5 packs' },
    { rarity: 'Rare', color: '#3b82f6', reward: '7 packs' },
    { rarity: 'Epic', color: '#a855f7', reward: '10 packs' },
    { rarity: 'Legendary', color: '#ff8c00', reward: '15 packs' },
    { rarity: 'Mythic', color: '#ef4444', reward: 'Mythic of choice' },
  ]

  return (
    <div className={`bm-panel rounded-xl p-3 ${className}`}>
      <div className="text-[9px] text-white/30 tracking-widest cd-head uppercase mb-2">Exchange Rates</div>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        {rates.map(r => (
          <Fragment key={r.rarity}>
            <div style={{ color: r.color }}>{r.rarity}</div>
            <div className="text-red-500 text-right">{r.reward}</div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
```

Add the `Fragment` import at the top:
```jsx
import { useState, useCallback, useMemo, useRef, Fragment, forwardRef } from 'react'
```

- [ ] **Step 6: MythicSelectionModal component**

```jsx
function MythicSelectionModal({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('god')
  const [confirming, setConfirming] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Catalog data imports — add these at the top of CCBlackMarket.jsx:
  // import { GODS, CLASS_ROLE } from '../../data/vault/gods'
  // import { ITEMS } from '../../data/vault/items'
  // import { CONSUMABLES } from '../../data/vault/buffs'

  const tabs = [
    { key: 'god', label: 'Gods' },
    { key: 'item', label: 'Items' },
    { key: 'consumable', label: 'Consumables' },
  ]

  // Build filterable catalog from static data
  const catalogItems = useMemo(() => {
    const q = search.toLowerCase()
    let items = []
    if (tab === 'god') {
      items = GODS.map(g => ({
        cardType: 'god', godId: g.slug, godName: g.name,
        godClass: g.class, role: CLASS_ROLE[g.class] || 'mid',
        label: g.name, sublabel: g.class,
      }))
    } else if (tab === 'item') {
      items = ITEMS.map(it => ({
        cardType: 'item', godId: `item-${it.id}`, godName: it.name,
        godClass: '', role: '',
        label: it.name, sublabel: it.type || 'Item',
      }))
    } else if (tab === 'consumable') {
      items = CONSUMABLES.map(c => ({
        cardType: 'consumable', godId: `consumable-${c.id}`, godName: c.name,
        godClass: '', role: '',
        label: c.name, sublabel: 'Consumable',
      }))
    }
    if (q) items = items.filter(i => i.label.toLowerCase().includes(q))
    return items
  }, [tab, search])

  const handleConfirm = async () => {
    if (!confirming || submitting) return
    setSubmitting(true)
    try {
      await onSelect({
        cardType: confirming.cardType,
        godId: confirming.godId,
        godName: confirming.godName,
        godClass: confirming.godClass || '',
        role: confirming.role || '',
        defId: confirming.defId || null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[80vh] bg-[#0a0008] border border-red-900/30 rounded-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-red-900/20 flex items-center justify-between">
          <h3 className="cd-head text-lg text-red-500 tracking-wider font-bold">Choose Your Mythic</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl cursor-pointer">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-red-900/20">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch('') }}
              className={`px-3 py-1 rounded text-xs cd-head tracking-wider cursor-pointer transition-colors ${
                tab === t.key ? 'bg-red-900/30 text-red-400' : 'text-white/30 hover:text-white/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tabs.find(t => t.key === tab)?.label || ''}...`}
            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-red-900/20 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-500/40"
          />
        </div>

        {/* Grid of catalog items */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {catalogItems.map(item => (
              <button
                key={item.godId}
                onClick={() => setConfirming(item)}
                className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  confirming?.godId === item.godId
                    ? 'border-red-500/50 bg-red-900/20'
                    : 'border-red-900/20 bg-black/30 hover:border-red-500/30'
                }`}
              >
                <div className="text-xs text-white truncate">{item.label}</div>
                <div className="text-[9px] text-white/30 truncate">{item.sublabel}</div>
              </button>
            ))}
          </div>
          {catalogItems.length === 0 && (
            <div className="text-center py-8 text-white/20 text-sm">No results</div>
          )}
        </div>

        {/* Confirmation */}
        {confirming && (
          <div className="p-4 border-t border-red-900/20 flex items-center justify-between">
            <span className="text-sm text-white/60">
              Create Mythic <span className="text-red-400 font-bold">{confirming.godName}</span>?
            </span>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)} className="px-4 py-1.5 rounded text-xs text-white/40 hover:text-white/60 cursor-pointer">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-1.5 rounded bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-bold cd-head tracking-wider cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/CCBlackMarket.jsx
git commit -m "feat(vault): add CCBlackMarket sub-components and mythic selection modal"
```

### Task 10: Polish — CSS animations, hand SVG, and final integration

**Files:**
- Modify: `src/pages/vault/CCBlackMarket.css`
- Modify: `src/pages/vault/CCBlackMarket.jsx` (if needed)

- [ ] **Step 1: Implement the full CSS file**

The CSS file needs these key sections. Write the complete CSS with:

1. `.bm-container` — dark background (`#0a0008`), min-height, relative positioning
2. `.bm-vignette` — absolute overlay with `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.9) 100%)`
3. `.bm-panel` — styled like `cd-panel` but with red tones: `background: rgba(0,0,0,0.3); border: 1px solid rgba(139,0,0,0.2)`
4. `.bm-drop-zone` — dashed red border, dark radial gradient background, min-height 200px
5. `.bm-drop-zone-active` — solid border, pulsing red glow (`box-shadow` animation)
6. `.bm-hand` — centered in drop zone, transition: transform 0.6s ease, opacity 0.4s
7. `.bm-hand-idle` — translateY(20%), full opacity
8. `.bm-hand-dragging` — translateY(10%), slight pulse
9. `.bm-hand-grab` — translateY(0%), with screen shake on parent
10. `.bm-hand-devour` — translateY(100%), opacity 0 (retreat into darkness)
11. `.bm-hand-return` — translateY(0%), animate from below
12. `.bm-hand-collect` — translateY(30%), reduced opacity (recedes while reward shown)
13. `.bm-hand-svg` — width: 120px (desktop), 80px (mobile), centered
14. `.bm-reward-fade-in` — fade + slide-up entrance
15. `@keyframes bm-screen-shake` — 2px x/y oscillation, 200ms
16. `.bm-phase-grab` — apply screen shake animation
17. Shadow particle keyframes if desired (optional polish — small floating dots with red tint that drift upward from the drop zone edges)

- [ ] **Step 2: Test the full flow manually**

Run `npm start` and navigate to `/vault?tab=packs&packMode=black-market`. Verify:
- Brudih cards appear (if user has any)
- Counter shows correct numbers
- Desktop: drag a card to the hand, watch 5-phase animation
- Mobile: tap a card, tap Turn In, watch animation
- Packs appear in inventory after collecting
- Mythic turn-in shows "Choose your mythic" + modal
- Error states (no Brudih cards, card locked, pending mythic)

- [ ] **Step 3: Final commit**

```bash
git add src/pages/vault/CCBlackMarket.css src/pages/vault/CCBlackMarket.jsx
git commit -m "feat(vault): polish Black Market animations, hand SVG, and CSS theme"
```

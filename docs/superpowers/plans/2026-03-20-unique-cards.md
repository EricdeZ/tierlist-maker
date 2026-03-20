# Unique Cards Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Unique Cards" tab to the Vault where owners can view their unique-rarity cards with full tilt/holo effects, change holo type (holo/reverse/full) freely, and request signatures — all inline.

**Architecture:** New lazy-loaded tab component `CCUniqueCards.jsx` reads from VaultContext's existing `collection` state, filtering for `rarity === 'unique'`. One new backend action `change-holo-type` in `vault.js` updates `cc_cards.holo_type`. Signature requests reuse the existing `request-signature` action. No new DB tables.

**Tech Stack:** React 19, Tailwind CSS 4, TradingCardHolo/GameCard/TradingCard/VaultCard components, Cloudflare Pages Functions, Neon PostgreSQL.

---

### Task 1: Backend — `change-holo-type` action

**Files:**
- Modify: `functions/api/vault.js` (add case + handler)
- Modify: `src/services/database.js` (add `changeHoloType` to vaultService)

- [ ] **Step 1: Add POST case to vault.js switch**

In `functions/api/vault.js`, add after the `request-signature` case (~line 127):

```js
case 'change-holo-type': return await handleChangeHoloType(sql, user, body)
```

- [ ] **Step 2: Add handler function**

In `functions/api/vault.js`, add before the `// ═══ Formatters ═══` section (~line 2266):

```js
// ═══ Unique Cards: Holo Type ═══

async function handleChangeHoloType(sql, user, body) {
  const { cardId, holoType } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  const validTypes = ['holo', 'reverse', 'full']
  if (!validTypes.includes(holoType)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'holoType must be holo, reverse, or full' }) }

  const [card] = await sql`
    SELECT id, owner_id, rarity, holo_type FROM cc_cards WHERE id = ${cardId}
  `
  if (!card) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Card not found' }) }
  if (card.owner_id !== user.id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not own this card' }) }
  if (card.rarity !== 'unique') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only unique cards can change holo type' }) }

  await sql`UPDATE cc_cards SET holo_type = ${holoType} WHERE id = ${cardId}`

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, holoType }) }
}
```

- [ ] **Step 3: Add `changeHoloType` to vaultService in database.js**

In `src/services/database.js`, add inside the `vaultService` object — after `requestSignature` (~line 1115) is fine, or anywhere before the closing `}` of the object:

```js
async changeHoloType(cardId, holoType) {
    return apiPost('vault', { action: 'change-holo-type' }, { cardId, holoType })
},
```

- [ ] **Step 4: Verify the backend works**

Run: `npm run dev:api` and test with a curl or browser dev tools. No automated test needed — this is a simple CRUD action behind auth.

- [ ] **Step 5: Commit**

```bash
git add functions/api/vault.js src/services/database.js
git commit -m "feat(vault): add change-holo-type action for unique cards"
```

---

### Task 2: Frontend — `CCUniqueCards.jsx` component

**Files:**
- Create: `src/pages/vault/CCUniqueCards.jsx`

**Context for implementer:**
- `useVault()` provides `collection` (array of card objects), `getDefOverride(card)`, `getTemplate(templateId)`, `refreshCollection()`
- Each card has: `id, godId, godName, godClass, role, rarity, holoEffect, holoType, imageUrl, cardType, cardData, defId, signatureUrl, templateId, bestGodName, isFirstEdition, isConnected, serialNumber`
- Card rendering depends on `cardType`:
  - `'player'` → `<TradingCard>` (see `CCStartingFive.jsx:toPlayerCardProps` for prop mapping)
  - `'collection'` → `<VaultCard>` (needs `getTemplate`)
  - `'god'`/`'item'`/`'consumable'` → `<GameCard>` wrapped in `<TradingCardHolo>` (see `CCStartingFive.jsx:toGameCardData`)
- All card types wrap in `<TradingCardHolo rarity={card.holoEffect} role={card.role} holoType={card.holoType}>` for tilt/holo
- `vaultService.changeHoloType(cardId, holoType)` — from Task 1
- `vaultService.requestSignature(cardId)` — existing, only works on player cards with `defId`
- Signature request only allowed when: card has no `signatureUrl`, card is `cardType === 'player'`, card has a `defId` with a `player_id`
- `getHoloEffect` from `src/data/vault/economy.js` maps rarity → visual effect name

- [ ] **Step 1: Create `CCUniqueCards.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useVault } from './VaultContext'
import { vaultService } from '../../services/database'
import { getHoloEffect } from '../../data/vault/economy'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { PenLine, Check, Clock, Loader2 } from 'lucide-react'

const HOLO_TYPES = [
  { key: 'holo', label: 'Holo', desc: 'Flat Cores' },
  { key: 'reverse', label: 'Reverse', desc: 'Multiplier' },
  { key: 'full', label: 'Full', desc: 'Hybrid' },
]

function toGameCardData(card, override) {
  const cd = card.cardData || {}
  const base = {
    name: card.godName, class: card.godClass, imageUrl: override?.custom_image_url || card.imageUrl,
    id: card.godId, serialNumber: card.serialNumber, metadata: override || undefined,
    signatureUrl: card.signatureUrl || undefined,
  }
  const type = card.cardType || 'god'
  if (type === 'god') return { ...base, role: card.role, ability: card.ability || cd.ability, imageKey: cd?.imageKey }
  if (type === 'item') return { ...base, category: cd.category || card.godClass, manaCost: cd.manaCost || 3, effects: cd.effects || {}, passive: cd.passive, imageKey: cd?.imageKey }
  if (type === 'consumable') return { ...base, color: cd.color || '#10b981', description: cd.description || '', manaCost: cd.manaCost || 1 }
  return base
}

function toPlayerCardProps(card) {
  const cd = card.cardData || {}
  return {
    playerName: card.godName, teamName: cd.teamName || '', teamColor: cd.teamColor || '#6366f1',
    role: card.role || cd.role || 'ADC', avatarUrl: card.imageUrl || '',
    leagueName: cd.leagueName || '', divisionName: cd.divisionName || '',
    seasonName: cd.seasonName || '',
    bestGod: card.bestGodName ? { name: card.bestGodName } : null,
    stats: cd.stats || null,
    isFirstEdition: card.isFirstEdition || false,
    isConnected: card.isConnected,
    defId: card.defId,
    rarity: card.rarity,
    signatureUrl: card.signatureUrl || undefined,
  }
}

function UniqueCardEntry({ card, getDefOverride, getTemplate, onHoloTypeChanged }) {
  const [changingHolo, setChangingHolo] = useState(false)
  const [requestingSig, setRequestingSig] = useState(false)
  const [sigStatus, setSigStatus] = useState(null) // 'requested' after success
  const [error, setError] = useState(null)
  const [localHoloType, setLocalHoloType] = useState(card.holoType)

  const override = getDefOverride(card)
  const holoEffect = card.holoEffect || getHoloEffect(card.rarity)
  const type = card.cardType || 'god'

  const canRequestSignature = type === 'player' && card.defId && !card.signatureUrl && sigStatus !== 'requested'

  const handleHoloChange = async (newType) => {
    if (newType === localHoloType || changingHolo) return
    setChangingHolo(true)
    setError(null)
    try {
      await vaultService.changeHoloType(card.id, newType)
      setLocalHoloType(newType)
      onHoloTypeChanged(card.id, newType)
    } catch (err) {
      setError(err.message || 'Failed to change holo type')
    } finally {
      setChangingHolo(false)
    }
  }

  const handleRequestSignature = async () => {
    if (requestingSig) return
    setRequestingSig(true)
    setError(null)
    try {
      await vaultService.requestSignature(card.id)
      setSigStatus('requested')
    } catch (err) {
      setError(err.message || 'Failed to request signature')
    } finally {
      setRequestingSig(false)
    }
  }

  const renderCard = () => {
    if (type === 'collection') {
      return <VaultCard card={{ ...card, holoType: localHoloType }} getTemplate={getTemplate} holo size={280} />
    }
    if (type === 'player') {
      return (
        <TradingCard
          {...toPlayerCardProps(card)}
          size={280}
          holo={{ rarity: holoEffect, holoType: localHoloType }}
        />
      )
    }
    return (
      <TradingCardHolo rarity={holoEffect} role={card.role || 'mid'} holoType={localHoloType} size={280}>
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={280} />
      </TradingCardHolo>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {renderCard()}

      {/* Holo Type Switcher */}
      <div className="flex items-center gap-1">
        {HOLO_TYPES.map(ht => (
          <button
            key={ht.key}
            onClick={() => handleHoloChange(ht.key)}
            disabled={changingHolo}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer cd-head ${
              localHoloType === ht.key
                ? 'bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/40'
                : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20'
            }`}
            title={ht.desc}
          >
            {ht.label}
          </button>
        ))}
      </div>

      {/* Signature Section */}
      {card.signatureUrl ? (
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold cd-head">
          <Check size={14} />
          Signed
        </div>
      ) : sigStatus === 'requested' ? (
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold cd-head">
          <Clock size={14} />
          Signature Requested
        </div>
      ) : canRequestSignature ? (
        <button
          onClick={handleRequestSignature}
          disabled={requestingSig}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-[var(--cd-magenta)]/15 text-[var(--cd-magenta)] border border-[var(--cd-magenta)]/30 hover:bg-[var(--cd-magenta)]/25 transition-all cursor-pointer cd-head"
        >
          {requestingSig ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
          Request Signature
        </button>
      ) : null}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export default function CCUniqueCards() {
  const { collection, loaded, getDefOverride, getTemplate, updateCardHoloType } = useVault()

  const uniqueCards = useMemo(
    () => collection.filter(c => c.rarity === 'unique'),
    [collection]
  )

  const handleHoloTypeChanged = (cardId, newType) => {
    updateCardHoloType(cardId, newType)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    )
  }

  if (uniqueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-white/40 text-sm">You don't own any unique cards yet.</p>
        <p className="text-white/20 text-xs mt-1">Unique cards are the rarest in the Vault — only one copy exists per card.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-black uppercase tracking-widest text-white cd-head">
          Unique Cards
        </h2>
        <p className="text-white/30 text-xs mt-1">
          {uniqueCards.length} unique card{uniqueCards.length !== 1 ? 's' : ''} in your collection
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {uniqueCards.map(card => (
          <UniqueCardEntry
            key={card.id}
            card={card}
            getDefOverride={getDefOverride}
            getTemplate={getTemplate}
            onHoloTypeChanged={handleHoloTypeChanged}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCUniqueCards.jsx
git commit -m "feat(vault): add CCUniqueCards component with holo type switcher and signature requests"
```

---

### Task 3: Wire tab into VaultPage

**Files:**
- Modify: `src/pages/VaultPage.jsx`

- [ ] **Step 1: Add lazy import**

After the `CCSignatureApprovals` import (~line 30), add:

```js
const CCUniqueCards = lazy(() => import('./vault/CCUniqueCards'))
```

- [ ] **Step 2: Add tab to TABS array**

Add before the `settings` entry in the `TABS` array (~line 46):

```js
{ key: 'unique', label: 'Unique Cards', icon: Gem, authOnly: true },
```

`Gem` must be added to the lucide-react import on line 9 of `VaultPage.jsx`. Do NOT use `Star` — it's already taken by the Challenges tab.

- [ ] **Step 3: Add to DESKTOP_MORE_KEYS**

Update the `DESKTOP_MORE_KEYS` set (~line 49) to include `'unique'`:

```js
const DESKTOP_MORE_KEYS = new Set(['settings', 'binder', 'catalog', 'unique'])
```

- [ ] **Step 4: Add to TAB_COMPONENTS**

Add to the `TAB_COMPONENTS` object (~line 66):

```js
unique: CCUniqueCards,
```

- [ ] **Step 5: Verify locally**

Run: `npm start`
- Navigate to `/vault?tab=unique`
- Verify tab appears in the "More" dropdown on desktop
- Verify tab appears in the mobile secondary drawer
- Verify empty state shows if no unique cards
- If you have unique cards, verify holo effects render and holo type buttons work

- [ ] **Step 6: Commit**

```bash
git add src/pages/VaultPage.jsx
git commit -m "feat(vault): wire Unique Cards tab into VaultPage"
```

---

### Task 4: Add `updateCardHoloType` to VaultContext

**Files:**
- Modify: `src/pages/vault/VaultContext.jsx`

`CCUniqueCards.jsx` (from Task 2) already calls `updateCardHoloType` from the context. This task adds the method to VaultContext so it works.

- [ ] **Step 1: Add `updateCardHoloType` callback to VaultContext**

In `VaultContext.jsx`, add a new callback after `refreshCollection` (~line 133):

```js
const updateCardHoloType = useCallback((cardId, newHoloType) => {
  setCollection(prev => prev.map(c => c.id === cardId ? { ...c, holoType: newHoloType } : c))
}, [])
```

Then expose it in two places:
1. Add `updateCardHoloType` to the `value` object in the `useMemo` call (~line 431), on the line with `refreshCollection`:
   ```js
   buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection, updateCardHoloType, refreshSalePacks, refreshBalance, claimEmberDaily,
   ```
2. Add `updateCardHoloType` to the `useMemo` dependency array (~line 444), on the matching line:
   ```js
   buyPack, buyPacksToInventory, buySalePack, convertPassionToEmber, dismantleCards, blackMarketTurnIn, blackMarketClaimMythic, refreshCollection, updateCardHoloType, refreshSalePacks, refreshBalance, claimEmberDaily,
   ```

- [ ] **Step 2: Verify**

- Change holo type on a unique card in the Unique Cards tab
- Navigate to Starting Five — if the card is slotted, verify the holo type is updated
- Navigate back to Unique Cards — verify it persists

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/VaultContext.jsx
git commit -m "feat(vault): add updateCardHoloType to VaultContext for cross-tab sync"
```

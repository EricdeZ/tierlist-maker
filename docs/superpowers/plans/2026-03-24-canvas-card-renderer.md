# Canvas Card Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render studio-created (element-based) cards everywhere in the vault with full holo/tilt/rarity support at any size.

**Architecture:** One new self-contained `CanvasCard` component handles all rendering internally (elements, border, rarity glow, holo/tilt). `VaultCard` gains an `elements` path that delegates to `CanvasCard`. All render sites that can show collection cards get a `type === 'collection'` branch. Dashboard previews migrate from `MiniCardPreview` to `CanvasCard`.

**Tech Stack:** React 19, CSS transform scaling, `useHoloEffect` hook, `prebuiltRenderers.jsx` reuse

**Spec:** `docs/superpowers/specs/2026-03-24-canvas-card-renderer-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Create** | `src/pages/vault/components/CanvasCard.jsx` | Self-contained scalable renderer for element-based cards |
| **Modify** | `src/pages/vault/components/VaultCard.jsx` | Add elements path before cardData path |
| **Modify** | `src/pages/vault/CCBinder.jsx` | Add collection branch in picker grid |
| **Modify** | `src/pages/vault/CCSignatureApprovals.jsx` | Add collection branch in approval list |
| **Modify** | `src/pages/vault/CCTrading.jsx` | Add collection branch in 3 components |
| **Modify** | `src/pages/vault/tradematch/Swiper.jsx` | Add collection branch in SwipeCard |
| **Modify** | `src/pages/vault/tradematch/CardPicker.jsx` | Add collection branch in PickerCard |
| **Modify** | `src/pages/vault/tradematch/Negotiation.jsx` | Add collection branch in OfferCard |
| **Modify** | `src/pages/vault/tradematch/MatchSplash.jsx` | Add collection branch in MatchCard |
| **Modify** | `src/pages/vault/tradematch/MatchesAndLikes.jsx` | Add collection branch in CardThumb |
| **Modify** | `src/pages/vault-dashboard/CollectionShowcase.jsx` | Replace MiniCardPreview with CanvasCard |
| **Modify** | `src/pages/vault-dashboard/editor/RarityStrip.jsx` | Replace MiniCardPreview with CanvasCard |
| **Modify** | `src/pages/vault-dashboard/DraftsPage.jsx` | Replace MiniCardPreview with CanvasCard |
| **Modify** | `src/pages/vault-dashboard/TemplatesPage.jsx` | Replace MiniCardPreview with CanvasCard |
| **Modify** | `src/pages/vault-dashboard/CollectionsPage.jsx` | Replace MiniCardPreview with CanvasCard |
| **Delete** | `src/pages/vault-dashboard/preview/MiniCardPreview.jsx` | Replaced by CanvasCard |

---

### Task 1: Create CanvasCard component

**Files:**
- Create: `src/pages/vault/components/CanvasCard.jsx`

**Reference files to read first:**
- `src/pages/vault-dashboard/preview/MiniCardPreview.jsx` — element rendering logic to replicate
- `src/pages/vault-dashboard/preview/HoloPreview.jsx` — holo wrapper pattern
- `src/pages/vault-dashboard/preview/prebuiltRenderers.jsx` — reuse `isPrebuiltType`, `renderPrebuiltContent`
- `src/components/TradingCardHolo.jsx` — holo DOM structure to replicate
- `src/hooks/useHoloEffect.js` — hook for 3D tilt
- `src/data/vault/economy.js` — `RARITIES` for glow colors

- [ ] **Step 1: Create CanvasCard.jsx with the full component**

```jsx
import useHoloEffect from '../../../hooks/useHoloEffect'
import { isPrebuiltType, renderPrebuiltContent } from '../../vault-dashboard/preview/prebuiltRenderers'
import { RARITIES } from '../../../data/vault/economy'
import '../../../components/TradingCardHolo.css'

const BASE_W = 300
const BASE_H = 420

function CardElement({ el }) {
    const style = {
        position: 'absolute',
        left: el.x ?? 0,
        top: el.y ?? 0,
        width: el.w ?? '100%',
        height: el.h ?? '100%',
        opacity: el.opacity ?? 1,
        zIndex: el.z ?? 0,
        pointerEvents: 'none',
    }

    switch (el.type) {
        case 'image':
            return (
                <div style={style}>
                    {el.url && <img src={el.url} alt="" className="w-full h-full object-cover" draggable={false} />}
                </div>
            )
        case 'text':
            return (
                <div style={{ ...style, width: 'auto', height: 'auto', padding: '2px 4px' }}>
                    <span className="whitespace-nowrap" style={{
                        fontFamily: el.font || 'Cinzel, serif',
                        fontSize: el.fontSize ?? 20,
                        color: el.color || '#ffffff',
                        fontWeight: el.bold ? 'bold' : 'normal',
                        textShadow: el.shadow ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none',
                        letterSpacing: el.letterSpacing ?? 0,
                    }}>
                        {el.content || 'Text'}
                    </span>
                </div>
            )
        case 'stats': {
            const stats = el.stats || {}
            return (
                <div style={{ ...style, width: el.w ?? 120, height: 'auto' }}>
                    <div className="p-2 rounded" style={{ background: el.bgColor || 'rgba(0,0,0,0.7)' }}>
                        {Object.entries(stats).map(([key, val]) => (
                            <div key={key} className="flex justify-between gap-3 text-xs" style={{ color: el.color || '#ffffff' }}>
                                <span className="opacity-70">{key}</span>
                                <span className="font-bold">{val}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        case 'effect':
            return null
        default:
            if (isPrebuiltType(el.type)) {
                return (
                    <div style={{ ...style, width: el.w ?? BASE_W, height: el.h ?? 'auto' }}>
                        {renderPrebuiltContent(el)}
                    </div>
                )
            }
            return null
    }
}

function CardContent({ elements, border, rarity, signatureUrl }) {
    const visible = (elements || []).filter(el => el.visible !== false)
    const sorted = [...visible].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    const firstImage = elements?.find(el => el.type === 'image')
    const rarityColor = RARITIES[rarity]?.color || '#9ca3af'
    const radius = border?.enabled ? (border.radius ?? 12) : 12

    return (
        <div
            className="relative overflow-hidden"
            style={{
                width: BASE_W,
                height: BASE_H,
                borderRadius: radius,
                background: firstImage?.bgColor || '#111827',
            }}
        >
            {sorted.map(el => <CardElement key={el.id} el={el} />)}

            {/* Signature overlay — full-card transparent PNG, same as GameCard.css .game-card__signature */}
            {signatureUrl && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 800,
                    pointerEvents: 'none', borderRadius: radius, overflow: 'hidden',
                }}>
                    <img src={signatureUrl} alt="Signature" loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'fill',
                                 filter: 'drop-shadow(0 0 3px #e8e8ff66)' }} />
                </div>
            )}

            {/* Border overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: radius,
                boxShadow: border?.enabled
                    ? `inset 0 0 0 ${border.width ?? 3}px ${border.color ?? '#d4af37'}`
                    : 'inset 0 0 0 1px #374151',
                zIndex: 900,
            }} />

            {/* Rarity glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: radius,
                boxShadow: `0 0 12px 2px ${rarityColor}30`,
                zIndex: 901,
            }} />
        </div>
    )
}

export default function CanvasCard({ elements, border, rarity = 'common', size = 240, holo, signatureUrl }) {
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const scale = size / BASE_W
    const height = size * (BASE_H / BASE_W)

    const content = (
        <CardContent
            elements={elements}
            border={border}
            rarity={rarity}
            signatureUrl={signatureUrl}
        />
    )

    const scaledContent = (
        <div style={{ width: size, height, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BASE_W, height: BASE_H }}>
                {content}
            </div>
        </div>
    )

    if (!holo) return scaledContent

    return (
        <div
            className={`holo-card ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-rarity={holo.rarity}
            data-holo-type={holo.holoType}
            style={{ ...dynamicStyles, width: size, '--card-scale': size / 340 }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...handlers}>
                    <div className="holo-card__front">
                        {scaledContent}
                        <div className="holo-card__shine" />
                        {holo.rarity === 'unique' && <div className="holo-card__shine2" />}
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds (CanvasCard is not imported yet, but should have no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/components/CanvasCard.jsx
git commit -m "feat(vault): add CanvasCard component for studio-created cards"
```

---

### Task 2: Update VaultCard to use CanvasCard

**Files:**
- Modify: `src/pages/vault/components/VaultCard.jsx`

**Reference:** Read `VaultCard.jsx` first — current code is 46 lines.

- [ ] **Step 1: Add CanvasCard import and elements path**

Add import at top:
```jsx
import CanvasCard from './CanvasCard'
```

Replace the early return on line 19:
```jsx
// OLD:
if (!template?.cardData) return <EmptyCardSlot rarity={card.rarity} size={size} />
```

With the elements-first check:
```jsx
// NEW — elements path (studio canvas cards)
if (template?.elements?.length) {
    const holoEffect = holo ? getHoloEffect(card.rarity) : null
    const holoType = card.holoType || card.holo_type || 'reverse'
    const canvas = (
        <CardErrorBoundary fallback={<EmptyCardSlot rarity={card.rarity} size={size} />}>
            <CanvasCard
                elements={template.elements}
                border={template.border}
                rarity={card.rarity}
                size={size ? parseFloat(size) : 240}
                holo={holo ? { rarity: holoEffect, holoType } : undefined}
                signatureUrl={card.signatureUrl}
            />
        </CardErrorBoundary>
    )
    return canvas
}

// Structured card path (existing)
if (!template?.cardData) return <EmptyCardSlot rarity={card.rarity} size={size} />
```

Also remove the `TradingCardHolo` import since VaultCard no longer needs it for the elements path (it's still used for the structured card holo path below). Actually — keep it, since the structured card path at lines 36-44 still uses `TradingCardHolo`.

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds

- [ ] **Step 3: Manually verify in browser**

Open the vault, navigate to a page that shows collection cards. Cards that previously showed as empty placeholders should now render with their studio design.

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/components/VaultCard.jsx
git commit -m "feat(vault): route element-based templates through CanvasCard in VaultCard"
```

---

### Task 3: Add collection branch — Vault pages

**Files:**
- Modify: `src/pages/vault/CCBinder.jsx:585-600`
- Modify: `src/pages/vault/CCSignatureApprovals.jsx:80-112`
- Modify: `src/pages/vault/CCTrading.jsx:1365,1828,1900`

- [ ] **Step 1: CCBinder.jsx — picker grid**

Read `CCBinder.jsx` lines 560-610. The picker grid at line 585-600 needs a collection check. VaultCard is already imported.

In the `.map(card => ...)` block around line 585, change the rendering:

```jsx
// OLD:
{available.map(card => {
  const isPlayer = (card.cardType || 'god') === 'player'
  return (
    <div key={card.id} className="binder-picker__card" onClick={() => onPick(card.id)}>
      {isPlayer ? (
        <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={130} />
      ) : (
        <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={toGameCardData(card)} compact size={130} />
      )}
    </div>
  )
})}
```

```jsx
// NEW:
{available.map(card => {
  const type = card.cardType || 'god'
  const isCollection = type === 'collection'
  const isPlayer = type === 'player'
  return (
    <div key={card.id} className="binder-picker__card" onClick={() => onPick(card.id)}>
      {isCollection ? (
        <VaultCard card={card} getTemplate={getTemplate} size={130} holo={false} />
      ) : isPlayer ? (
        <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={130} />
      ) : (
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card)} compact size={130} />
      )}
    </div>
  )
})}
```

Note: The `CardPicker` function inside CCBinder does NOT call `useVault()` — it receives data via props. You must add `const { getTemplate } = useVault()` inside `CardPicker` (or the parent render closure that contains the `.map(card => ...)` block). Check the actual function scope and add the hook at the appropriate level.

- [ ] **Step 2: CCSignatureApprovals.jsx — approval list**

Read `CCSignatureApprovals.jsx` lines 80-115. Add VaultCard import at top:

```jsx
import VaultCard from './components/VaultCard'
```

Add `getTemplate` to the `useVault()` destructuring at the top of the component.

In the rendering block around line 88, add collection branch before the player/game split:

```jsx
// Before the existing:
// {req.cardType === 'player' ? ( <TradingCard ... /> ) : ( <TradingCardHolo> <GameCard ... /> </TradingCardHolo> )}

// Add collection check first:
{req.cardType === 'collection' ? (
  <VaultCard card={req} getTemplate={getTemplate} size={200} holo />
) : req.cardType === 'player' ? (
  // ... existing TradingCard code ...
) : (
  // ... existing TradingCardHolo > GameCard code ...
)}
```

Note: Signature approvals are always for unique cards, so the holo wrapping should match the existing pattern.

- [ ] **Step 3: CCTrading.jsx — 3 fixes**

Read `CCTrading.jsx` lines 1360-1370, 1820-1875, 1895-1960.

**Fix 1 — Desktop CardZoomModal (line ~1365):** Add the missing `collectionCard` prop:

```jsx
// OLD:
<CardZoomModal
  onClose={() => setZoomedCard(null)}
  gameCard={zoomedCard.gameCard}
  playerCard={zoomedCard.playerCard}
  holoType={zoomedCard.holoType}
/>

// NEW:
<CardZoomModal
  onClose={() => setZoomedCard(null)}
  collectionCard={zoomedCard.collectionCard}
  gameCard={zoomedCard.gameCard}
  playerCard={zoomedCard.playerCard}
  holoType={zoomedCard.holoType}
/>
```

**Fix 2 — DesktopTradeCardSlot (line ~1828):** Add `getTemplate` to the `useVault()` destructuring and add `isCollection` check:

```jsx
// Add to destructuring:
const { getDefOverride, getTemplate } = useVault()

// Add isCollection check:
const isCollection = card.cardType === 'collection'

// In the rendering JSX, before the existing isPlayer ? ... :
{isCollection ? (
  <VaultCard card={card} getTemplate={getTemplate} size={100} holo={false} />
) : isPlayer ? (
  // ... existing TradingCard code ...
) : (
  // ... existing GameCard code ...
)}
```

**Fix 3 — CollectionPickerCard (line ~1900):** Same pattern:

```jsx
// Add isCollection check:
const isCollection = (card.cardType || 'god') === 'collection'

// In the rendering JSX:
{isCollection ? (
  <VaultCard card={card} getTemplate={getTemplate} size={cardSize} holo={false} />
) : isPlayer ? (
  // ... existing TradingCard code ...
) : (
  // ... existing GameCard code ...
)}
```

Add `getTemplate` to the `useVault()` destructuring if not already present in CollectionPickerCard. The parent may already have it — check the function's scope.

- [ ] **Step 4: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/pages/vault/CCBinder.jsx src/pages/vault/CCSignatureApprovals.jsx src/pages/vault/CCTrading.jsx
git commit -m "feat(vault): add collection card branches to binder, approvals, and trading"
```

---

### Task 4: Add collection branch — Tradematch pages

**Files:**
- Modify: `src/pages/vault/tradematch/Swiper.jsx`
- Modify: `src/pages/vault/tradematch/CardPicker.jsx`
- Modify: `src/pages/vault/tradematch/Negotiation.jsx`
- Modify: `src/pages/vault/tradematch/MatchSplash.jsx`
- Modify: `src/pages/vault/tradematch/MatchesAndLikes.jsx`

All 5 files follow the identical pattern: they branch on `isPlayer` and fall through to GameCard. Add a collection check before the player check.

**Important:** These files receive snake_case card data from the feed API. VaultCard already handles `card.template_id` and `card.holo_type` (snake_case variants). The card object from the feed should include `_templateData` inline for collection cards (backend prerequisite). If `_templateData` is not present, VaultCard falls through to `getTemplate()` which may or may not have the template cached.

- [ ] **Step 1: Swiper.jsx — SwipeCard**

Add VaultCard import at top:
```jsx
import VaultCard from '../components/VaultCard'
```

Add `getTemplate` to the existing `useVault()` destructuring in SwipeCard:
```jsx
const { getDefOverride, getTemplate } = useVault()
```

In the `SwipeCard` function around line 563, add collection check:

```jsx
const type = card.card_type || cd.cardType || 'god'
const isPlayer = type === 'player'
const isCollection = type === 'collection'
```

Then in the rendering block (around line 572), before the existing `if (isPlayer)`:

```jsx
if (isCollection) {
    const holoType = card.holo_type || null
    const holoEffect = holoType ? getHoloEffect(card.rarity) : null
    cardEl = (
        <VaultCard
            card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
            getTemplate={getTemplate}
            size={cardSize}
            holo={!!holoEffect}
        />
    )
} else if (isPlayer) {
    // ... existing code ...
```

- [ ] **Step 2: CardPicker.jsx — PickerCard**

Add VaultCard import:
```jsx
import VaultCard from '../components/VaultCard'
```

Add `getTemplate` to `useVault()` destructuring in PickerCard:
```jsx
const { getDefOverride, getTemplate } = useVault()
```

Add collection check around line 60:
```jsx
const isCollection = type === 'collection'
```

In the rendering (around line 65), add before `if (isPlayer)`:
```jsx
if (isCollection) {
    inner = (
        <VaultCard
            card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
            getTemplate={getTemplate}
            size={CARD_SIZE}
            holo={false}
        />
    )
} else if (isPlayer) {
    // ... existing ...
```

- [ ] **Step 3: Negotiation.jsx — OfferCard**

Same pattern as CardPicker. Add VaultCard import. Add `getTemplate` to `useVault()`. Add collection check before player check. Size is `CARD_SIZE` (90px).

```jsx
if (isCollection) {
    inner = (
        <VaultCard
            card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
            getTemplate={getTemplate}
            size={CARD_SIZE}
            holo={false}
        />
    )
} else if (isPlayer) {
```

- [ ] **Step 4: MatchSplash.jsx — MatchCard**

Add VaultCard import:
```jsx
import VaultCard from '../components/VaultCard'
```

Add `getTemplate` to `useVault()`:
```jsx
const { getDefOverride, getTemplate } = useVault()
```

Add collection check around line 27:
```jsx
const isCollection = type === 'collection'
```

In the rendering (around line 32), add before the existing `isPlayer ? ...`:
```jsx
{isCollection ? (
    <VaultCard
        card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
        getTemplate={getTemplate}
        size={120}
        holo={false}
    />
) : isPlayer ? (
    // ... existing TradingCard code ...
) : (
    // ... existing GameCard code ...
)}
```

- [ ] **Step 5: MatchesAndLikes.jsx — CardThumb**

Add VaultCard import:
```jsx
import VaultCard from '../components/VaultCard'
```

Add `getTemplate` to `useVault()` destructuring in CardThumb. Add collection check:

```jsx
const isCollection = type === 'collection'
```

In the rendering (around line 84), add before `if (isPlayer)`:
```jsx
if (isCollection) {
    inner = (
        <VaultCard
            card={{ ...card, cardType: 'collection', templateId: card.template_id, _templateData: cd._templateData }}
            getTemplate={getTemplate}
            size={size}
            holo={false}
        />
    )
} else if (isPlayer) {
```

- [ ] **Step 6: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/tradematch/Swiper.jsx src/pages/vault/tradematch/CardPicker.jsx src/pages/vault/tradematch/Negotiation.jsx src/pages/vault/tradematch/MatchSplash.jsx src/pages/vault/tradematch/MatchesAndLikes.jsx
git commit -m "feat(vault): add collection card branches to all tradematch pages"
```

---

### Task 5: Replace MiniCardPreview with CanvasCard in dashboard pages

**Files:**
- Modify: `src/pages/vault-dashboard/CollectionShowcase.jsx`
- Modify: `src/pages/vault-dashboard/editor/RarityStrip.jsx`
- Modify: `src/pages/vault-dashboard/DraftsPage.jsx`
- Modify: `src/pages/vault-dashboard/TemplatesPage.jsx`
- Modify: `src/pages/vault-dashboard/CollectionsPage.jsx`

- [ ] **Step 1: CollectionShowcase.jsx**

Read `CollectionShowcase.jsx` fully. Replace MiniCardPreview import with CanvasCard:

```jsx
// OLD:
import MiniCardPreview from './preview/MiniCardPreview'

// NEW:
import CanvasCard from '../vault/components/CanvasCard'
```

In the `EntryRow` component, replace the MiniCardPreview usage (around line 83):

```jsx
// OLD:
) : hasElements ? (
    <div style={{
        boxShadow: `0 0 8px 2px ${RARITIES[rarity]?.color || '#9ca3af'}40`,
        borderRadius: 6,
    }}>
        <MiniCardPreview templateData={td} />
    </div>
)

// NEW:
) : hasElements ? (
    <CanvasCard
        elements={td.elements}
        border={td.border}
        rarity={rarity}
        size={CARD_SIZE}
    />
)
```

The wrapping `<div>` with manual boxShadow is no longer needed — CanvasCard has its own rarity glow.

- [ ] **Step 2: RarityStrip.jsx**

Read `RarityStrip.jsx` around lines 170-178. Replace import:

```jsx
// OLD:
import MiniCardPreview from '../preview/MiniCardPreview'

// NEW:
import CanvasCard from '../../vault/components/CanvasCard'
```

Replace MiniCardPreview usage in the full_art rarity strip (around line 173):

```jsx
// OLD:
<MiniCardPreview templateData={{ elements, border }} />

// NEW:
<CanvasCard elements={elements} border={border} rarity={r} size={120} />
```

- [ ] **Step 3: DraftsPage.jsx**

Read `DraftsPage.jsx` around line 135. Replace import:

```jsx
// OLD:
import MiniCardPreview from './preview/MiniCardPreview'

// NEW:
import CanvasCard from '../vault/components/CanvasCard'
```

Replace MiniCardPreview usage:

```jsx
// OLD:
<MiniCardPreview templateData={d.template_data} />

// NEW:
<CanvasCard
    elements={d.template_data?.elements}
    border={d.template_data?.border}
    size={120}
/>
```

- [ ] **Step 4: TemplatesPage.jsx**

Read `TemplatesPage.jsx` around line 171. Replace import:

```jsx
// OLD:
import MiniCardPreview from './preview/MiniCardPreview'

// NEW:
import CanvasCard from '../vault/components/CanvasCard'
```

Replace MiniCardPreview usage:

```jsx
// OLD:
<MiniCardPreview templateData={t.template_data} />

// NEW:
<CanvasCard
    elements={t.template_data?.elements}
    border={t.template_data?.border}
    size={120}
/>
```

- [ ] **Step 5: CollectionsPage.jsx**

Read `CollectionsPage.jsx` around line 295. Replace import:

```jsx
// OLD:
import MiniCardPreview from './preview/MiniCardPreview'

// NEW:
import CanvasCard from '../vault/components/CanvasCard'
```

Replace MiniCardPreview usage:

The actual code wraps MiniCardPreview in a container div:
```jsx
// OLD (full context):
<div className="w-full aspect-[63/88] bg-white/5 rounded flex items-center justify-center">
    <MiniCardPreview templateData={entry.template_data} size={120} />
</div>

// NEW — replace entire wrapper since CanvasCard handles its own sizing:
<CanvasCard
    elements={entry.template_data?.elements}
    border={entry.template_data?.border}
    size={120}
/>
```

- [ ] **Step 6: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault-dashboard/CollectionShowcase.jsx src/pages/vault-dashboard/editor/RarityStrip.jsx src/pages/vault-dashboard/DraftsPage.jsx src/pages/vault-dashboard/TemplatesPage.jsx src/pages/vault-dashboard/CollectionsPage.jsx
git commit -m "refactor(vault): replace MiniCardPreview with CanvasCard in all dashboard pages"
```

---

### Task 6: Delete MiniCardPreview

**Files:**
- Delete: `src/pages/vault-dashboard/preview/MiniCardPreview.jsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "MiniCardPreview" src/` — should return 0 results.

- [ ] **Step 2: Delete the file**

```bash
rm src/pages/vault-dashboard/preview/MiniCardPreview.jsx
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run build 2>&1 | head -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add -u src/pages/vault-dashboard/preview/MiniCardPreview.jsx
git commit -m "chore(vault): remove deprecated MiniCardPreview (replaced by CanvasCard)"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no warnings related to card components

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Manual smoke test checklist**

Open the app and verify collection cards render in:
- Pack opening (open a pack containing a collection card)
- Binder (view + picker grid)
- Starting Five (slot a collection card)
- Dismantle page
- Marketplace (browse + create listing)
- Trading (mobile + desktop, offer cards, zoom modal)
- Unique cards gallery
- Tradematch (swiper, card picker, negotiation, match splash, matches list)
- Dashboard (collection showcase, rarity strip, drafts, templates, collections)

Verify at different sizes: cards should look identical at 70px and 280px (just smaller).
Verify holo: collection cards with holo should tilt and show shine/glare effects.

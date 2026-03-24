# Canvas Card Renderer — Design Spec

## Problem

Studio-created cards (element-based `template_data` with `elements[]` array) have no rendering path outside the vault dashboard. `VaultCard` line 19 bails to `EmptyCardSlot` when a template has `elements` but no `cardData`. Additionally, 10 card rendering sites across the vault don't have a `collection` type branch at all.

## Solution

One new self-contained component (`CanvasCard`) + updates to `VaultCard` + collection-type branches added to all missing render sites.

---

## 1. CanvasCard Component

**File:** `src/pages/vault/components/CanvasCard.jsx`

Self-contained, scalable renderer for element-based cards. Handles holo, tilt, sizing, rarity glow internally — same API pattern as `TradingCard`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `elements` | `Element[]` | `[]` | Studio element array |
| `border` | `{ enabled, color, width, radius }` | `null` | Studio border config |
| `rarity` | `string` | `'common'` | Card rarity (drives outer glow color) |
| `size` | `number` | `240` | Width in px |
| `holo` | `{ rarity, holoType }` or `undefined` | `undefined` | When present, enables 3D tilt + shine/glare |
| `signatureUrl` | `string` or `undefined` | `undefined` | Signature image overlay |

### Rendering Architecture

- **Base canvas:** 300x420px, all elements positioned absolutely with their stored x/y/w/h/z/opacity/visible values
- **Card background:** The first `image` element's `bgColor` property is used as the card's background color (matching existing MiniCardPreview/HoloPreview behavior). Falls back to `#111827`.
- **Scaling:** CSS `transform: scale(size / 300)` with `transformOrigin: top left`. Wrapper div sized to `size` x `size * 1.4` (5:7 ratio matching 300:420)
- **Element rendering:** Reuses `isPrebuiltType()` + `renderPrebuiltContent()` from `prebuiltRenderers.jsx` for prebuilt types. Custom rendering for image, text, stats types (same logic as MiniCardPreview/HoloPreview)
- **Effect elements:** Filtered out — rarity-based holo comes from the holo wrapper, not baked-in studio effects
- **Border:** Inset `box-shadow` using studio's `border` config (color, width, radius). When `border.enabled` is false, defaults to `inset 0 0 0 1px #374151`
- **Rarity glow:** Subtle outer `box-shadow` using `RARITIES[rarity].color` at low opacity
- **Signature:** If `signatureUrl` provided, rendered as absolute-positioned image overlay (same as StructuredCard)

### Holo Mode

CanvasCard builds its own holo wrapper internally (does NOT use the external `TradingCardHolo` component). This follows the same pattern as `TradingCard`, which also builds the holo DOM internally when its `holo` prop is set.

When `holo` prop is provided:
- Uses `useHoloEffect()` hook directly for 3D spring-physics tilt, pointer tracking, shine/glare
- Builds the holo DOM structure: `holo-card` > `holo-card__translater` > `holo-card__rotator` > `holo-card__front` > card content + shine/glare layers
- Imports `TradingCardHolo.css` for the holo styles
- Adds `holo-card__shine`, `holo-card__glare` layers
- Extra `holo-card__shine2` for `unique` rarity
- Sets `data-rarity={holo.rarity}`, `data-holo-type={holo.holoType}`
- Sets `--card-scale: size / 340` for CSS-driven effect scaling

When `holo` is absent: renders flat card content only, no tilt/shine.

### Element Types — Complete Property Preservation

Every element property from the studio is rendered:

**image:** `url`, `bgColor`, `x`, `y`, `w`, `h`, `z`, `opacity`, `visible`

**text:** `content`, `font`, `fontSize`, `color`, `bold`, `shadow`, `letterSpacing`, `x`, `y`, `z`, `opacity`, `visible`. Auto-sized (width/height from content). Shadow: `1px 1px 3px rgba(0,0,0,0.8)`. Note: `letterSpacing` is stored by CardCanvas but was never rendered by MiniCardPreview or HoloPreview — CanvasCard fixes this gap.

**stats:** `stats` (key-value object), `color`, `bgColor`, `x`, `y`, `w`, `h`, `z`, `opacity`, `visible`. Rendered as rows with dimmed labels and bold values.

**name-banner:** `playerName`, `roleLabel`, `role`, `theme`, `font`, `fontSize`, `nameColor`, `bgOpacity`, `x`, `y`, `w`, `z`, `opacity`, `visible`. Colors from `getResolvedPalette()`.

**stats-block:** `rows[]`, `record`, `showRecord`, `role`, `theme`, `font`, `fontSize`, `bgOpacity`, `x`, `y`, `w`, `h`, `z`, `opacity`, `visible`. Colors from `getResolvedPalette()`.

**text-block:** `title`, `content`, `role`, `theme`, `color`, `font`, `fontSize`, `bgOpacity`, `x`, `y`, `w`, `h`, `z`, `opacity`, `visible`. Colors from `getResolvedPalette()`.

**subtitle:** `text`, `role`, `theme`, `color`, `font`, `fontSize`, `showBg`, `bgOpacity`, `x`, `y`, `w`, `z`, `opacity`, `visible`. Centered, uppercase.

**footer:** `leftText`, `rightText`, `role`, `theme`, `font`, `fontSize`, `showBg`, `bgOpacity`, `x`, `y`, `w`, `z`, `opacity`, `visible`. Left = serial, right = rarity label.

**effect:** Skipped in render (holo comes from wrapper).

### Size Behavior

Identical appearance at all sizes. The transform-scale approach means every detail (text, borders, spacing) scales proportionally. Tested sizes in the app: 70px, 80px, 90px, 100px, 105px, 120px, 130px, 140px, 170px, 200px, 240px, 280px, 300px.

---

## 2. VaultCard Update

**File:** `src/pages/vault/components/VaultCard.jsx`

Update the rendering priority:

```
1. template.elements?.length → CanvasCard (new path)
2. template.cardData           → StructuredCard (existing)
3. neither                     → EmptyCardSlot (existing fallback)
```

For the elements path:
- Compute `holoEffect` from `getHoloEffect(card.rarity)` when `holo=true`
- Extract `holoType` from `card.holoType || card.holo_type || 'reverse'` (same as existing line 38)
- Pass `holo={{ rarity: holoEffect, holoType }}` to CanvasCard
- Pass `signatureUrl` from `card.signatureUrl` through to CanvasCard
- Wrap in `CardErrorBoundary` (existing pattern)

---

## 3. Render Site Updates — Complete List

### Already Handled (12 sites — no changes needed)

These all call `VaultCard` which now delegates to `CanvasCard`:

1. `CCBinder.jsx:640` — BinderCardRender
2. `CCStartingFive.jsx:1435` — SlotCard (170px)
3. `CCDismantle.jsx:538` — DismantleSlot (130px)
4. `CCMarketplace.jsx:60` — MarketCard (140/120px)
5. `CCTrading.jsx:1481` — TradeCard mobile (105px)
6. `CCTrading.jsx:1107` — Mobile CardZoomModal (280px)
7. `CCUniqueCards.jsx:100,194` — UniqueCardEntry + Gallery (280px)
8. `CCSignatureRequests.jsx:15,53` — CardPreview + CardBg (240px)
9. `BinderSharePage.jsx:78` — ShareCardRender
10. `CardZoomModal.jsx:176` — collectionCard branch (280px)
11. `PackOpening.jsx:82` — PackCard
12. `TradePileManager.jsx:301` — card grid (130px)

### Need Collection Branch Added (10 sites)

All follow the same pattern: add `type === 'collection'` check that renders VaultCard before the existing player/game branching.

13. **`CCBinder.jsx:586`** — Picker grid (130px). Add collection check before `isPlayer` check. Import already present.

14. **`CCSignatureApprovals.jsx:88`** — Approval list (200px). Add collection branch before the player/TradingCardHolo branching. Add VaultCard import.

15. **`CCTrading.jsx:1828`** — DesktopTradeCardSlot (100px). Add `isCollection` check matching the mobile TradeCard pattern. VaultCard import already present.

16. **`CCTrading.jsx:1900`** — CollectionPickerCard (130px). Add `isCollection` check. VaultCard import already present.

17. **`CCTrading.jsx:1365`** — Desktop CardZoomModal. Add missing `collectionCard={zoomedCard.collectionCard}` prop (mobile version at line 1107 already has it).

18. **`tradematch/Swiper.jsx:559`** — SwipeCard (dynamic size). Add collection check. Add VaultCard import. Use `getTemplate` from `useVault()`.

19. **`tradematch/CardPicker.jsx:57`** — PickerCard (80px). Same pattern.

20. **`tradematch/Negotiation.jsx:48`** — OfferCard (90px). Same pattern.

21. **`tradematch/MatchSplash.jsx:23`** — MatchCard (120px). Same pattern.

22. **`tradematch/MatchesAndLikes.jsx:75`** — CardThumb (70px). Same pattern.

**Snake-case note for items 18-22:** Tradematch components receive card objects from the feed API with snake_case fields (`card_type`, `card_data`, `god_name`, `holo_type`, `template_id`). VaultCard already handles both `card.templateId` and `card.template_id` (line 17), and both `card.holoType` and `card.holo_type` (line 38). For template data, collection cards in the feed must include `_templateData` inline (see Section 4). No field normalization is needed at the render sites — VaultCard handles both naming conventions.

### Dashboard Pages — Replace MiniCardPreview with CanvasCard (5 sites)

These currently use MiniCardPreview (fixed 120x168, no rarity/holo). Replace with CanvasCard for visual consistency and rarity treatment.

23. **`CollectionShowcase.jsx:83`** — EntryRow elements path. Use CanvasCard at `CARD_SIZE` (120px) with rarity glow. Each rarity column shows the card with correct rarity glow.

24. **`RarityStrip.jsx:173`** — Elements preview in studio rarity strip. Use CanvasCard at strip thumbnail size.

25. **`DraftsPage.jsx:135`** — Draft list thumbnails. Use CanvasCard at 120px.

26. **`TemplatesPage.jsx:171`** — Template list thumbnails. Use CanvasCard at 120px.

27. **`CollectionsPage.jsx:295`** — Collection entry thumbnails. Use CanvasCard at 120px.

### Not Applicable (no changes needed)

- **Admin pages** (CCAdminGods/Items/Minions/Buffs/Consumables, CCCardEditor) — Only render game data cards, never collection type
- **CCCollection.jsx** — Game card collection grid (god/item/consumable/minion/buff only)
- **CCCardCatalog.jsx** — Game card catalog only
- **CardCreator.jsx** — Studio editor, uses CardCanvas/HoloPreview for editing
- **DirectSignModal.jsx** — Only renders god/player cards for signing

---

## 4. Backend Prerequisite

Tradematch feed endpoints and marketplace browse endpoints return other users' cards. For collection cards to render, these responses must include `template_data` (the template's `elements`/`border`/`cardData`) either:
- Inline on the card object as `_templateData` (existing pattern from vault load), or
- Via a separate template cache lookup

Without this, collection cards from other users fall back to `EmptyCardSlot`. The vault load endpoint already sends `templateCache` — the tradematch/marketplace APIs may need the same treatment.

---

## 5. MiniCardPreview Deprecation

After all 5 dashboard sites are updated to use CanvasCard, MiniCardPreview has no remaining consumers and can be deleted. CanvasCard is strictly more capable (scalable, rarity-aware, holo-capable).

---

## File Summary

| Action | Files |
|--------|-------|
| **New file** | `src/pages/vault/components/CanvasCard.jsx` |
| **Modify** | `src/pages/vault/components/VaultCard.jsx` |
| **Add collection branch** | `CCBinder.jsx`, `CCSignatureApprovals.jsx`, `CCTrading.jsx` (3 spots), `Swiper.jsx`, `CardPicker.jsx`, `Negotiation.jsx`, `MatchSplash.jsx`, `MatchesAndLikes.jsx` |
| **Replace MiniCardPreview** | `CollectionShowcase.jsx`, `RarityStrip.jsx`, `DraftsPage.jsx`, `TemplatesPage.jsx`, `CollectionsPage.jsx` |
| **Delete** | `src/pages/vault-dashboard/preview/MiniCardPreview.jsx` (after migration) |
| **Total files touched** | 17 |

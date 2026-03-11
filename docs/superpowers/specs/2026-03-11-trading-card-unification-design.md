# Trading Card Unification

## Problem

`TradingCard` and `TradingCardHolo` are separate components that are almost always composed together. Stats loading is done ad-hoc by consumers (CardZoomModal fetches, others pass empty stats). The image fallback chain is duplicated inline in TradingCard and in `usePlayerAvatar` hook. `GameCard` still has a dead `PlayerCardContent` type.

### Existing bugs (to be fixed by this unification)

Each consumer builds its own ad-hoc `playerCard` object for `CardZoomModal` with inconsistent fields, causing broken zoom behavior:

| Consumer | defId | bestGod info | isConnected | Result |
|----------|-------|--------------|-------------|--------|
| **CCStartingFive** | missing | passes `bestGod` object but modal reads `bestGodName` string | missing | **No stats, image falls to initials** |
| **CCCollection** | yes | `bestGodName` string | yes | Works correctly |
| **CCMarketplace** | yes | missing | missing | **No god fallback image** |
| **CCTrading** | yes | missing | yes | **No god fallback image** |

Root cause: CardZoomModal expects `playerCard.bestGodName` (a string) but some consumers pass `playerCard.bestGod` (an object). Also, `toPlayerCardProps` in CCStartingFive omits `defId` entirely, preventing stats fetch.

The unification fixes this by having `TradingCard` own the `loadStats` fetch — consumers just pass `defId` and TradingCard fetches `stats`, `bestGod`, `isConnected`, `seasonName` itself.

## Goal

A single `TradingCard` component (player-only) with two optional flags:
- `holo` — enables tilt + glare + shine layer
- `loadStats` — fetches stats from API internally via `defId`

Plus a centralized image resolution function.

## Design

### TradingCard is now player-only

The existing `variant` prop and the non-player layout branch (HP value, centered emblem, name bar below emblem) are removed. TradingCard always renders the player layout. `CardPreview.jsx` must be updated — its `makeSampleCard` and `SHOWCASE_CARDS` need `variant="player"` behavior or be refactored to match the new player-only API.

### New TradingCard API

```jsx
<TradingCard
  // Required
  playerName="Adapting"
  role="MID"

  // Identity (for image resolution + stats loading)
  avatarUrl={discordAvatarUrl}
  bestGod={{ name: 'Tsukuyomi', imageUrl: '...', games: 5, winRate: 80 }}
  isConnected={true}

  // Display
  teamName="Camelot Knights"
  teamColor="#9a5cc4"
  leagueName="SPL"
  divisionName="Division A"
  seasonName="Season 2"
  rarity="epic"
  isFirstEdition={true}
  size={340}

  // Optional: stats (pass directly OR use loadStats)
  stats={{ kda: 4.1, gamesPlayed: 12, ... }}

  // Optional flag: fetch stats from API using defId
  loadStats={defId}  // falsy = no fetch, truthy = fetch via vaultService.getCardDetail(defId)

  // Optional flag: enable holo effect
  holo={{ rarity: 'gold', holoType: 'full' }}  // falsy = flat card, truthy = tilt+glare+shine
/>
```

### `loadStats` behavior

When `loadStats` is truthy (a `defId` value):
1. Component calls `vaultService.getCardDetail(defId)` on mount
2. Shows a spinner overlay while loading
3. On success, merges fetched `stats`, `bestGod`, `bestGodName`, `seasonName`, `isConnected` into render
4. Passed `stats` prop is used as fallback / initial value

This moves the fetch logic from `CardZoomModal` into `TradingCard` itself. This does introduce a service import into a previously-pure presentational component, but only one consumer (CardZoomModal) currently does this fetch, and having it as a built-in flag is cleaner than each consumer reimplementing it.

### `holo` behavior

When `holo` is truthy (an object `{ rarity, holoType }`):
1. TradingCard wraps its content in the rotator/translater/glare/shine DOM structure
2. Attaches pointer/touch event handlers for tilt + spring physics
3. Renders `holo-card__shine` and `holo-card__glare` overlays
4. `role` for holo accent color is derived from TradingCard's own `role` prop (not in `holo` object)

When falsy, renders the card flat with no wrapper, no event handlers.

### Shared `useHoloEffect` hook

`TradingCardHolo` is also used as a wrapper for `GameCard` (gods, items, etc.) in CardZoomModal, PackOpening, StartingFive, and CardCatalog. So `TradingCardHolo.jsx` stays as a thin wrapper for non-player cards.

To avoid duplicating the spring physics + interaction logic, extract a shared hook:

**`src/hooks/useHoloEffect.js`** — contains `useSpring`, `clamp`, `round`, `adjust`, and the pointer interaction logic. Returns `{ cardRef, dynamicStyles, interacting, active, handlers }`.

Both `TradingCard` (when `holo` is truthy) and `TradingCardHolo` use this hook.

### Image resolution

Extract initial source resolution into `src/utils/playerAvatar.js`:

```js
export function resolvePlayerImage({ avatarUrl, bestGodName, isConnected }) {
  if (avatarUrl) return { src: avatarUrl, isGodImage: false }
  if (bestGodName && isConnected !== false) return { src: getGodCardUrl(bestGodName), isGodImage: true }
  return { src: null, isGodImage: false }
}
```

This replaces the initial state computation. The runtime `onError` fallback chain stays in TradingCard (Discord fails → try god card → show passionless/initials). This is the same logic as today, just with the initial resolution extracted.

Note: `src/pages/forge/usePlayerAvatar.js` is a separate concern (pre-tests images via `Image()` objects for CSS `background-image` where `onError` isn't available). It is intentionally not being consolidated.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useHoloEffect.js` | **New** — extracted spring physics + pointer interaction from TradingCardHolo |
| `src/components/TradingCard.jsx` | Player-only (remove non-player branch + `variant` prop), absorb holo via `useHoloEffect`, add `holo` + `loadStats` props, use `resolvePlayerImage` |
| `src/components/TradingCard.css` | Remove non-player-specific styles (`.card-name-bar`, centered `.card-emblem`, HP styles) |
| `src/components/TradingCardHolo.jsx` | Refactored to use `useHoloEffect` (thin wrapper remains for GameCard) |
| `src/components/TradingCardHolo.css` | No change |
| `src/utils/playerAvatar.js` | Add `resolvePlayerImage()` |
| `src/pages/vault/components/GameCard.jsx` | Remove `PlayerCardContent`, remove `type === 'player'` branch |
| `src/pages/vault/components/CardZoomModal.jsx` | Remove stats fetch logic, pass `loadStats={defId}` + `holo` to TradingCard |
| `src/pages/vault/CCBinder.jsx` | Update `BinderCardRender` + `CardPicker` — no more manual holo wrapping for player cards |
| `src/pages/vault/CCStartingFive.jsx` | Update player card rendering to use `holo` prop |
| `src/pages/vault/CCPlayerCards.jsx` | Remove manual TradingCardHolo wrapping |
| `src/pages/vault/CCCardCatalog.jsx` | Remove manual TradingCardHolo wrapping |
| `src/pages/vault/CCCollection.jsx` | Update player card rendering |
| `src/pages/vault/CCDismantle.jsx` | Update player card rendering |
| `src/pages/vault/CCMarketplace.jsx` | Update player card rendering |
| `src/pages/vault/CCTrading.jsx` | Update player card rendering |
| `src/pages/vault/components/PackOpening.jsx` | Remove manual TradingCardHolo wrapping for player cards |
| `src/pages/vault/CardSharePage.jsx` | Remove manual TradingCardHolo wrapping |
| `src/pages/vault/BinderSharePage.jsx` | Update player card rendering |
| `src/pages/admin/CardPreview.jsx` | Remove manual TradingCardHolo wrapping, update to player-only API |
| `src/pages/admin/vault/CCAdminShare.jsx` | Remove manual TradingCardHolo wrapping |

### What stays the same

- `TradingCardHolo.css` — all holo styles remain unchanged
- `GameCard` — continues to handle god, item, minion, buff, consumable types
- `<TradingCardHolo><GameCard .../></TradingCardHolo>` — still works for non-player card holos
- `ForgePlayerCard` — untouched, different system entirely
- `usePlayerAvatar` (forge) — untouched, solves a different problem (CSS background-image pre-testing)

### Result

- `<TradingCard holo={...} loadStats={defId} />` — self-contained player card with holo + auto-fetched stats
- `<TradingCard stats={myStats} />` — flat player card with pre-loaded stats
- `<TradingCard />` — flat player card, no stats section
- `<TradingCardHolo><GameCard .../></TradingCardHolo>` — holo wrapper for non-player cards (unchanged)
- No code duplication — shared `useHoloEffect` hook

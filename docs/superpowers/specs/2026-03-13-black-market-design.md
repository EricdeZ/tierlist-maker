# Black Market Design Spec

## Overview

A hidden subpage within the Vault's Packs section where users can turn in player cards of **Brudih** in exchange for league-specific packs (or a mythic card of choice for mythic rarity). Features a theatrical drag-to-shadowy-hand interaction with a full 5-phase animation sequence.

## Entry Point

New `black-market` mode in the existing `PackShopRouter` toggle bar alongside MY PACKS / SHOP / LIMITED SALE. Styled in deep red to contrast the vault's cyan theme, with a sinister dot indicator.

## Reward Tiers

| Rarity    | Reward                              |
|-----------|-------------------------------------|
| Common    | 3 league-specific mixed packs       |
| Uncommon  | 5 league-specific mixed packs       |
| Rare      | 7 league-specific mixed packs       |
| Epic      | 10 league-specific mixed packs      |
| Legendary | 15 league-specific mixed packs      |
| Mythic    | Mythic card of user's choice (any)  |

**League-specific**: A BSL Brudih card yields BSL mixed packs, an OSL Brudih yields OSL mixed packs, etc. The league is determined from the card's `cc_player_defs` entry.

## Brudih Counter

Top banner displays two stats:
- **Turned In**: Lifetime count of Brudih cards sacrificed (stored as `brudihs_turned_in` in `cc_stats`)
- **In Collection**: Current count of Brudih cards owned (live query on `cc_cards` filtered by `player_name = 'Brudih'`)

## Layout

### Desktop (>=640px)
- Two-zone side-by-side grid
- **Left**: User's Brudih cards in a 3-column grid, filterable by league
- **Right**: The shadowy hand drop zone with reward preview
- Drag direction: horizontal (left → right)
- Hover a card over the drop zone to see the reward preview

### Mobile (<640px)
- Stacked vertically: hand zone on top, cards below
- Cards displayed in a horizontal scroll row
- **Tap-to-confirm flow**: Tap a card to select it (shows reward preview + confirm button), tap "Turn In" to trigger the animation. Native drag-and-drop is unreliable on mobile touch, so tap-to-confirm is the primary mobile interaction. The animation sequence (phases 2-5) plays identically after confirmation.
- Exchange rates table below the cards section

## Visual Theme

The entire Black Market section overrides the vault's cyan theme:
- Deep reds and blacks (`#ff3333`, `rgba(139,0,0,...)`)
- Heavy vignette (radial gradient darkening edges)
- The hand is a dark silhouette emerging from fog/shadow — not an emoji. Slightly curled fingers, red ambient glow, shadow particles at the edges. Implementation can use CSS art or inline SVG, whichever achieves the best result.

## Animation Sequence (5 Phases)

### Phase 1 — Drag (user-driven)
User drags a Brudih card toward the hand zone. Card lifts with elevated shadow, tilts slightly. Hand zone pulses with a faint red glow as the card approaches. Reward preview text appears in the drop zone showing what the user will receive.

### Phase 2 — Grab (~400ms)
Card snaps to center of drop zone. Hand transitions from open palm to closed fist around the card. Brief red flash overlay. Subtle screen shake (2px, 200ms). **API call fires at this point** — the card is committed.

### Phase 3 — Devour (~1200ms)
Hand (holding card) retreats into darkness — slides down/back with easing (600ms). Shadow particles wisp outward from the zone. The zone goes fully dark. 600ms pause in darkness to build anticipation.

### Phase 4 — Return (~800ms)
Hand re-emerges from darkness, now holding the reward:
- **Packs**: Fanned-out pack miniatures on the palm
- **Mythic**: A single card silhouette with pulsing rainbow glow

Hand slides up/forward smoothly. Red ambient glow intensifies.

### Phase 5 — Collect (user-driven)
Reward fans out in the center of the zone. Reward text fades in below (e.g., "5x BSL Mixed Packs"). User taps **"Collect"** button to add packs to inventory and dismiss the animation. Counter updates. Hand resets to idle state.

**Mythic special case**: Instead of "Collect", the text reads "Choose your mythic". Tapping opens a full-screen modal with a searchable grid of every card in the catalog. User picks one, confirms, and receives it.

**Total automated animation**: ~2.4 seconds. Fast enough to feel snappy, slow enough to feel theatrical.

## Auth

Requires `requireAuth` (logged-in user). No special permission needed — any vault user can access the Black Market.

## API

### `POST /api/vault?action=black-market-turn-in`

**Input**: `{ cardId }`

**Server-side flow** (entire flow wrapped in a single transaction):
1. Validate card exists and is owned by the requesting user
2. Validate card's `cc_player_defs` entry has `player_name = 'Brudih'`
3. Validate card is not in Starting Five, marketplace listing, active trade, or binder (same guards as dismantle)
4. Block if `pending_mythic_claim > 0` — user must claim their pending mythic first
5. Look up rarity → reward count mapping
6. Look up league from `cc_player_defs.league_id` → pack type via `{league_slug}-mixed` convention (e.g., league_slug `bsl` → `bsl-mixed`). If no matching pack type exists for the league, reject with error.
7. Mutations (inside same transaction):
   - Delete card from `cc_cards`
   - For non-mythic: insert N reward packs into `cc_pack_inventory` with the league-specific pack type
   - For mythic: increment `pending_mythic_claim` in `cc_stats` (no packs inserted)
   - Increment `brudihs_turned_in` in `cc_stats`
8. Return `{ success: true, reward: { type: 'packs', packType, count } }` or `{ success: true, reward: { type: 'mythic_choice' } }`

### `POST /api/vault?action=black-market-claim-mythic`

**Input**: `{ cardType, godId }` — identifies which card from the catalog. `cardType` is one of `god`, `item`, `consumable`, `player`, `minion`. `godId` is the card's identifier (god slug, `item-{id}`, `player-{id}-t{teamId}`, etc.).

**Server-side flow**:
1. Validate user has `pending_mythic_claim > 0` in `cc_stats`
2. Validate the requested card definition exists in the catalog
3. Transaction:
   - Create a new mythic card in `cc_cards` with the selected definition, `rarity = 'mythic'`, `holo_effect = 'rainbow'`, `acquired_via = 'black-market'`
   - Decrement `pending_mythic_claim` in `cc_stats`
4. Return the created card

### Mythic Selection Modal

Full-screen modal with tabs for each card type (Gods / Items / Players / Consumables / Minions). Each tab shows a searchable grid. Search is frontend-only — the full card catalog is already loaded in `VaultContext` from the card catalog data files. User selects a card, sees a confirmation prompt ("Create Mythic [card name]?"), then confirms to fire the claim-mythic API call.

## Database Changes

### `cc_stats` — add columns:
- `brudihs_turned_in INTEGER DEFAULT 0` — lifetime counter
- `pending_mythic_claim INTEGER DEFAULT 0` — tracks unclaimed mythic rewards (integer to handle edge cases; blocked from turning in another mythic while > 0)

No new tables needed. Uses existing `cc_cards`, `cc_pack_inventory`, `cc_player_defs`, `cc_stats`.

## Frontend Components

- `CCBlackMarket.jsx` — Main component, lazy-loaded in `PackShopRouter`
- `CCBlackMarket.css` — Dark theme override, hand illustration (CSS art), drag/drop zones, 5-phase animation keyframes

## Card Identification

Brudih cards are identified by joining `cc_cards` to `cc_player_defs` on `def_id` and filtering where `player_name = 'Brudih'`. The league for pack rewards comes from the same `cc_player_defs` row's `league_id`.

# Card Fan Showcase — Design Spec

## Purpose
Add a "Generate Promo Image" tool inside the CollectionShowcase view that lets staff select 1-5 cards from a collection, arrange them in a fanned layout with configurable controls, and export a transparent PNG for Discord promo posts.

## Location
New `FanShowcase` component rendered at the top of `CollectionShowcase.jsx`, above the existing card entry rows.

## Card Selection

- Display collection's card blueprints as small thumbnails in a horizontal scrollable row
- Click a thumbnail to add it to the fan (max 5)
- On selection, show a rarity picker dropdown (common → mythic, filtered to available rarities for that blueprint)
- Selected cards shown as removable chips below the picker (click X to remove)
- Drag-to-reorder selected cards to control fan stacking order (left-to-right maps to back-to-front)

## Fan Preview

- Live preview using the existing `VaultCard` component at the chosen size/rarity
- Cards positioned with CSS transforms calculated from control values:
  - Rotation: each card offset by `angle * (index - center)` degrees
  - X-offset: each card offset by `spacing * (index - center)` pixels (derived from overlap %)
  - Y-offset: `arc * (index - center)^2` pixels downward (parabolic curve, center card highest)
  - Z-index: center card on top, decreasing outward
- Checkered background pattern in preview to indicate transparency
- Container sized dynamically based on card count + spread

## Controls

| Control | Type | Range | Default | Effect |
|---------|------|-------|---------|--------|
| Fan Angle | Slider | 5°-40° | 15° | Rotation spread per card from center |
| Overlap | Slider | 20%-80% | 40% | Horizontal spacing (% of card width between cards) |
| Card Size | Slider | 150px-350px | 240px | Card render width (height follows 63:88 ratio) |
| Card Order | Drag handles | — | Selection order | Reorder cards in the fan |
| Arc | Slider | 0-50px | 15px | Vertical curve depth (0 = flat line) |

## Export

- "Export PNG" button captures the fan container using `html-to-image` (toPng) from existing `ExportCanvas.js` pattern
- Render at 2x pixel ratio for crisp output
- Transparent background (checkered pattern excluded from capture via CSS class filter)
- Download filename: `{collection-slug}-showcase.png`

## Files

| File | Action |
|------|--------|
| `src/pages/vault-dashboard/CollectionShowcase.jsx` | Add `FanShowcase` component above entry rows, pass entries + collection as props |
| `src/pages/vault-dashboard/FanShowcase.jsx` | New file — card picker, fan preview, controls, export logic (~250 lines) |

## Dependencies

- `VaultCard` — existing card renderer (handles structured + canvas + holo)
- `html-to-image` — already used in `ExportCanvas.js` for card PNG export
- No new npm packages needed
- No API changes needed — collection entries already loaded by CollectionShowcase

## Out of Scope

- Saving showcase presets/configurations
- Text overlays or watermarks on the export
- Background color/image options (transparent only)
- Sharing directly to Discord from the tool

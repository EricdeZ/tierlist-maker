# BgRemover V2 — Advanced Background Removal Tool

## Overview

Upgrade the existing BgRemover from a 2-mode tool (Sample + Crop) to a full image editing suite with 7 tools, zoom/pan, undo/redo, edge detection, and selection system. All client-side, no external dependencies, pure canvas API + custom Sobel edge detection.

## Tools

### 1. Sample (existing, key: S)
- Click colors to flood-fill remove with tolerance + feathering
- Current behavior preserved exactly

### 2. Brush (key: B)
- Paint to erase or restore pixels
- Size: 1-200px, adjustable via slider or `[`/`]` keys
- Hardness: 0-100% (soft to sharp edge via Gaussian falloff)
- Mode: Erase / Restore, toggle with `X` key
- Edge-aware toggle: when on, brush respects Sobel gradient — won't bleed across strong edges
- Cursor shows brush size circle on overlay canvas

### 3. Lasso (key: L)
- Freehand draw closed selection path
- Auto-closes on mouse release (line back to start)
- Creates selection mask
- Marching ants animation on active selection
- Actions: Delete Selection, Keep Selection (invert), Clear

### 4. Magnetic Lasso (key: M)
- Like freehand lasso but snaps control points to high-gradient pixels
- Uses Sobel edge map to find nearest edge within snap radius (15px)
- Click to place anchor points, path snaps between them
- Double-click or click start point to close
- Same selection actions as Lasso

### 5. Magic Wand (key: W)
- Click to select contiguous region by color similarity
- Uses flood fill (like Sample) but creates selection mask instead of directly removing
- Tolerance slider (shared with Sample)
- Shift+click to add to selection, Alt+click to subtract
- Same selection actions as Lasso

### 6. Crop (existing, key: C)
- Current behavior preserved exactly

### 7. Zoom (key: Z)
- Click to zoom in, Alt+click to zoom out
- Drag to pan

## Zoom & Pan System

- Scroll wheel zooms centered on cursor (10% steps, 10%-2000%)
- `Ctrl+scroll` zooms from any tool
- `Ctrl+0` fit to view, `Ctrl++`/`Ctrl+-` zoom in/out
- `Space+drag` pans from any tool
- Zoom level indicator top-left of canvas
- Minimap bottom-right when zoomed past 100%
- Implementation: CSS transform scale+translate on canvas container
- `screenToCanvas(e)` converts all mouse coords accounting for zoom/pan

## Dual Canvas Architecture

1. **Image canvas** — the actual pixel data, transformed for zoom
2. **Overlay canvas** — fixed position, renders tool UI: brush cursor, lasso path, marching ants, selection visualization. Always in screen space, stays crisp at any zoom.

## Selection System

- Shared `Uint8Array` mask (0=unselected, 255=selected) sized to display canvas
- Used by Lasso, Magnetic Lasso, Magic Wand
- Marching ants: dashed line animation on overlay canvas, offset cycles every 200ms
- Feather slider: Gaussian blur on selection mask edges before applying
- Actions:
  - Delete Selection: set alpha=0 for selected pixels
  - Keep Selection: invert mask, then delete
  - Feather Edge: blur selection boundary
  - Clear Selection: reset mask
- `Del` key deletes selection, `Ctrl+Shift+I` inverts

## Edge Detection (Sobel)

- Computed once on image load from grayscale conversion
- Outputs: `gradientMag` (Float32Array, 0-1 normalized) and `gradientDir` (Float32Array, radians)
- Used by:
  - Edge-aware brush: reduces brush opacity where gradient is strong and perpendicular to stroke
  - Magnetic lasso: snaps path points to local gradient maxima
- Pure JS, operates on display-resolution data (not full-res) for speed

## Undo/Redo

- History stack: array of ImageData snapshots, max 30
- Push on: brush stroke end, selection action (delete/keep), sample click, crop apply
- `Ctrl+Z` undo, `Ctrl+Shift+Z` redo
- Pointer tracks current position; new action after undo truncates future states

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| S | Sample tool |
| B | Brush tool |
| L | Lasso tool |
| M | Magnetic Lasso tool |
| W | Magic Wand tool |
| C | Crop tool |
| Z | Zoom tool |
| X | Swap erase/restore (brush) |
| [ / ] | Decrease/increase brush size |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Space+drag | Pan (any tool) |
| Ctrl+scroll | Zoom (any tool) |
| Ctrl+0 | Fit to view |
| Ctrl++ / Ctrl+- | Zoom in/out |
| Del | Delete selection |
| Ctrl+Shift+I | Invert selection |
| Esc | Clear selection / cancel lasso |

## UI Layout

```
[Sample] [Brush] [Lasso] [MagLasso] [Wand] [Crop] [Zoom]  |  [Undo] [Redo]
--- context options bar (changes per tool) ---
[canvas viewport with overlay]
--- sampled colors / selection actions ---
--- tolerance / size controls ---
--- download bar ---
```

## Toolbar Context Options (per tool)

- **Sample**: tolerance slider
- **Brush**: size slider, hardness slider, erase/restore toggle, edge-aware toggle
- **Lasso**: feather slider, Delete/Keep/Clear buttons
- **Magnetic Lasso**: snap radius, feather slider, Delete/Keep/Clear buttons
- **Magic Wand**: tolerance slider, Delete/Keep/Clear buttons
- **Crop**: clear crop button
- **Zoom**: zoom level display, fit-to-view button

## File Structure

Single file: `src/pages/BgRemover.jsx` (as requested by user). Helper functions at top, component at bottom. Logical sections via comments:
1. Constants & utilities
2. Sobel edge detection
3. Flood fill (existing, kept)
4. Selection utilities (mask ops, marching ants, feather)
5. Brush utilities
6. Magnetic lasso path snapping
7. History (undo/redo) hook
8. Main component

## What's Preserved

- Existing flood fill algorithm (untouched)
- Crop mode (untouched)
- Output size controls with aspect ratio lock
- Drag-drop / paste / file picker upload
- Checkerboard transparency pattern
- Download as PNG
- Dark theme styling

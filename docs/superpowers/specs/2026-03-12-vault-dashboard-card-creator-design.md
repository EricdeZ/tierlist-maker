# Vault Dashboard & Card Creator — Design Spec

**Date:** 2026-03-12
**Status:** Draft

---

## Overview

A new top-level admin section (`/vault-dashboard/*`) for designing and composing trading cards. Separate from the existing `/admin/vault` management tools. Features a dual-mode card editor: template mode for common-through-mythic cards using predefined structures, and a full layer editor for the new "Full Art" rarity with stackable image, effect, text, and frame layers. Access requires `owner` or a new `vault_member` permission. Designs go through an owner approval queue before becoming usable.

---

## Routing, Layout & Permissions

### Route Structure

```
/vault-dashboard (VaultDashboardLayout)
  ├─ /                → Card Creator (default)
  ├─ /templates       → Template browser/manager
  ├─ /drafts          → Review queue
  └─ /assets          → Asset library
```

### Layout

`VaultDashboardLayout` follows the Codex pattern: a dedicated `VaultDashboardNavbar` with four tabs plus an `<Outlet />`. Not nested under `/admin`.

### Permissions

- New global permission: `vault_member` — grants access to the Vault Dashboard and card creator. Automatically granted to the Owner role (which has all permissions).
- New global permission: `vault_approve` — grants ability to approve/reject/archive designs and delete assets. Granted only to the Owner role.
- Route-level `ProtectedRoute` with `requiredPermission="vault_member"` — Owner-role users pass this check because they have all permissions.
- Approval/rejection/archive uses `requirePermission(event, 'vault_approve')` on the backend.
- Asset deletion uses `requirePermission(event, 'vault_approve')`.
- `vault_member` users (without `vault_approve`) can create, edit, and submit designs but cannot publish them.

### Navigation

Add "Vault Dashboard" to AdminNavbar's "More" dropdown, visible only to users with `vault_member` or owner role.

---

## Data Model

### New Rarity: `full_art`

Added to the `RARITIES` object in `functions/lib/vault.js` (where all rarities are defined):

```javascript
full_art: { dropRate: 0, color: '#d4af37', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos', 'galaxy', 'radiant'] }
```

Drop rate 0 — Full Art cards are only created manually through the card creator, never from packs. `full_art` must NOT be added to `RARITY_ORDER` (used by `rollRarity` and `rollRarityBounded` for pack drops) — it exists only in the `RARITIES` lookup for rendering and validation.

### New Tables

#### `cc_card_templates`

Reusable card designs that can be applied to multiple card instances.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `name` | text NOT NULL | Template name |
| `description` | text | Optional description |
| `card_type` | text NOT NULL | `player \| god \| item \| consumable \| minion \| buff \| custom` |
| `rarity` | text NOT NULL | `common` through `full_art` |
| `status` | text NOT NULL DEFAULT 'draft' | `draft \| pending_review \| approved \| rejected \| archived` |
| `template_data` | jsonb NOT NULL | Full layer stack and configuration |
| `thumbnail_url` | text | R2 URL for preview thumbnail |
| `rejection_reason` | text | Reviewer's feedback when rejecting |
| `created_by` | integer REFERENCES users(id) | |
| `approved_by` | integer REFERENCES users(id) | |
| `approved_at` | timestamptz | |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | |

**Indexes:** `status`, `created_by`, composite `(status, created_by)`

Note: Application code must set `updated_at = NOW()` on every UPDATE (no database triggers in this project).

#### `cc_card_drafts`

One-off card designs for specific cards (event prizes, promos).

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `card_type` | text NOT NULL | Same as templates |
| `rarity` | text NOT NULL | |
| `status` | text NOT NULL DEFAULT 'draft' | `draft \| pending_review \| approved \| rejected \| archived` |
| `template_data` | jsonb NOT NULL | Same structure as templates |
| `thumbnail_url` | text | |
| `target_player_id` | integer | Optional — links to a specific player/event |
| `notes` | text | Creator's notes to reviewer |
| `rejection_reason` | text | Reviewer's feedback when rejecting |
| `created_by` | integer REFERENCES users(id) | |
| `approved_by` | integer REFERENCES users(id) | |
| `approved_at` | timestamptz | |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | |

**Indexes:** `status`, `created_by`, composite `(status, created_by)`

#### `cc_asset_library`

Shared image assets for the card creator.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `name` | text NOT NULL | Display name |
| `category` | text NOT NULL | `background \| frame \| overlay \| texture \| character \| effect` |
| `url` | text NOT NULL | R2 path |
| `thumbnail_url` | text | Smaller version for grid views |
| `tags` | text[] DEFAULT '{}' | For search/filter |
| `metadata` | jsonb DEFAULT '{}' | Dimensions, file size, format |
| `uploaded_by` | integer REFERENCES users(id) | |
| `created_at` | timestamptz DEFAULT now() | |

**Indexes:** `category`, GIN index on `tags` for array search

### `template_data` JSONB Structure

```json
{
  "mode": "template | full_art",
  "baseCard": {
    "type": "player",
    "frameStyle": "default",
    "rarity": "rare",
    "holoType": "galaxy",
    "customName": null,
    "customStats": null,
    "customImage": null,
    "flavorText": null
  },
  "layers": [
    {
      "id": "bg-1",
      "type": "image",
      "assetId": 42,
      "url": "/vault-assets/backgrounds/cosmic.png",
      "z": 0,
      "opacity": 1,
      "blendMode": "normal",
      "position": { "x": 0, "y": 0 },
      "size": { "w": "100%", "h": "100%" },
      "visible": true
    },
    {
      "id": "char-1",
      "type": "image",
      "assetId": 15,
      "url": "/vault-assets/characters/loki.png",
      "z": 1,
      "opacity": 1,
      "blendMode": "normal",
      "position": { "x": 10, "y": 20 },
      "size": { "w": 200, "h": 300 },
      "visible": true
    },
    {
      "id": "holo-1",
      "type": "effect",
      "effectName": "rainbow",
      "z": 2,
      "opacity": 0.6,
      "blendMode": "overlay",
      "visible": true
    },
    {
      "id": "frame-1",
      "type": "frame",
      "frameStyle": "full_art_gold",
      "z": 3,
      "visible": true
    },
    {
      "id": "title-1",
      "type": "text",
      "content": "LOKI",
      "font": "Cinzel",
      "fontSize": 28,
      "color": "#ffffff",
      "position": { "x": 50, "y": 15 },
      "shadow": true,
      "stroke": null,
      "z": 4,
      "visible": true
    }
  ]
}
```

**Template mode** (common-mythic): The `layers` array is empty or minimal. The card renders from `baseCard` config using the existing `TradingCard` component structure. Custom overrides (name, stats, image, flavor text) are in `baseCard`.

**Full Art mode**: The `layers` array drives the entire visual. `baseCard` provides metadata (type, rarity) but the rendering is fully layer-driven.

---

## Card Creator Editor

### Layout

Two-panel layout: controls on the left (~40% width), live preview on the right (~60% width).

**Top bar:**
- Card name input (templates only)
- Mode toggle: Template Mode / Full Art Mode
- Rarity selector (common through full_art — selecting full_art auto-switches to Full Art mode)
- Action buttons: Save Draft, Save Template, Export PNG

### Template Mode Controls (Left Panel)

For common-through-mythic cards using predefined card structures:

1. **Card type picker** — player, god, item, consumable, minion, buff, custom
2. **Definition selector** — if player/god/item: search and select existing definition from the database
3. **Custom card fields** — if custom type: name, stats editor, flavor text, image upload
4. **Rarity dropdown** — sets available holo types per `vault-defs.js` mapping
5. **Holo type dropdown** — filtered by selected rarity
6. **Frame style picker** — thumbnail grid of available frames
7. **Image override** — upload replaces default card art

### Full Art Mode Controls (Left Panel)

Full layer composition for the Full Art rarity:

1. **Layer stack panel** — ordered list, drag to reorder
   - Each layer row: thumbnail, name, type badge (color-coded), visibility toggle (eye icon), delete button
   - "Add Layer" button opens type picker: Image / Effect / Frame / Text
2. **Layer properties panel** — shown for the selected layer:
   - **Image layer:** asset picker (opens library modal or upload), position X/Y (slider + input), size W/H (slider + input), opacity slider (0-1), blend mode dropdown (normal, overlay, multiply, screen, soft-light)
   - **Effect layer:** effect type dropdown (rainbow, sparkle, foil, cosmos, galaxy, radiant, secret, gold), opacity slider, blend mode dropdown, animation toggle (enables CSS animation in preview)
   - **Frame layer:** frame style picker (thumbnail grid), color tint picker
   - **Text layer:** content input, font picker (Cinzel, Bebas Neue, Inter, etc.), font size slider, color picker, position X/Y, shadow toggle, stroke color/width

### Live Preview (Right Panel)

- Card rendered at actual card dimensions using DOM-based rendering
- Template mode: renders via extended `TradingCard` component with custom overrides applied
- Full Art mode: renders layer stack as positioned `<div>`/`<img>` elements with CSS properties matching layer config
- Working CSS holo effects with mouse-tracking (shine, tilt, glare)
- Zoom controls: 50%, 100%, 150%
- Debug toggle: "Show layer outlines" draws borders around each layer

### Status Bar (Bottom)

- Change indicator (unsaved/saved)
- Current status badge (draft, pending review, approved, rejected)
- `vault_member` users: "Submit for Review" button (changes status to `pending_review`)
- Owner users: "Approve" and "Reject" buttons when viewing pending items

---

## Templates & Drafts Management

### Templates Page (`/vault-dashboard/templates`)

- Grid/list view of all templates
- Filter by: status (draft, pending, approved, archived), rarity, card type, creator
- Search by name
- Click to open in editor
- Status badges on each card
- Owner can: approve, reject, archive
- `vault_member` can: edit own drafts, submit for review

### Drafts Page (`/vault-dashboard/drafts`)

- Same layout as templates
- Shows one-off card designs
- Owner sees all drafts from all users
- `vault_member` sees only their own
- Filter by: status, rarity, creator
- "Notes" column showing creator's review notes
- Click to open in editor with approve/reject controls

### Review Workflow

1. Creator designs card in editor
2. Saves as draft or template (status: `draft`)
3. Clicks "Submit for Review" (status: `pending_review`)
4. Owner sees it in the drafts/templates list with pending badge
5. Owner opens it, reviews in the preview panel
6. Owner clicks "Approve" (status: `approved`, records `approved_by` and `approved_at`) or "Reject" with optional feedback note
7. Approved templates become available for card generation via existing `cardclash_manage` admin tools
8. Approved drafts can be minted as actual card instances

---

## Asset Library

### Library Page (`/vault-dashboard/assets`)

- Grid view with thumbnails
- Filter by category: background, frame, overlay, texture, character, effect
- Search by name and tags
- Upload: accepts PNG, JPG, WebP (max 2MB per file, consistent with existing `validateImageFile()` in `r2.js`)
- Bulk upload with drag-and-drop zone
- On upload: category picker, name field, tag input
- Asset detail on click: full preview, dimensions, file size, usage count (templates referencing this asset), uploaded by, date
- Delete: owner only, warns if referenced by templates

### Inline Asset Picker

Modal accessible from within the editor when configuring an image layer:

- Same grid + filter/search as library page
- "Upload New" tab for uploading without leaving the editor
- Click asset to select — returns `assetId` + `url` to the layer config

### Storage

- R2 bucket under `vault-assets/` prefix
- Organized by category: `vault-assets/backgrounds/`, `vault-assets/frames/`, etc.
- Thumbnails generated client-side (200px wide via canvas resize in browser) before upload, stored as `vault-assets/thumbnails/`
- **Required change:** Add `'vault-assets/'` to `ALLOWED_PREFIXES` in `functions/lib/r2.js` so assets can be served via `/api/r2-image`

---

## PNG Export

### In-App Export

- "Export PNG" button in the editor top bar
- Renders the current card preview to a canvas using the existing `canvasExport.js` approach
- For holo effects: composites a static snapshot of the holo overlay at its current visual state (frozen frame of the animated effect)
- Output: downloads as PNG file, also uploads to R2 as the template/draft's `thumbnail_url`

### Export Process

1. Capture the DOM preview panel dimensions
2. Walk the layer stack, drawing each layer onto an offscreen canvas in z-order
3. For image layers: draw the image at configured position, size, opacity, blend mode
4. For effect layers: draw the corresponding static holo texture/gradient at configured opacity and blend mode
5. For frame layers: draw the frame overlay
6. For text layers: draw text with configured font, size, color, shadow, stroke
7. Export canvas as PNG blob
8. Trigger download + upload thumbnail to R2

---

## API Endpoints

Two backend files:

1. **`functions/api/vault-dashboard.js`** — JSON endpoints, wrapped with `adapt()`. Uses `requirePermission(event, 'vault_member')` for read/write, `requirePermission(event, 'vault_approve')` for approval actions. Uses `adminHeaders(event)` for CORS.

2. **`functions/api/vault-dashboard-upload.js`** — File upload endpoint, exports raw `onRequest(context)` (NOT wrapped with `adapt()`, same pattern as `codex-upload.js`). Uses `request.formData()` for multipart handling. Validates with `validateImageFile()` from `r2.js`. Handles asset upload and thumbnail export.

### Read Endpoints (GET) — `vault-dashboard.js`

| Action | Description | Permission |
|--------|-------------|------------|
| `templates` | List/search templates (filter by status, rarity, type, creator) | vault_member |
| `template` | Get single template by ID | vault_member |
| `drafts` | List drafts (vault_approve sees all, vault_member sees own) | vault_member |
| `draft` | Get single draft by ID | vault_member (own) or vault_approve |
| `assets` | List/search assets (filter by category, tags) | vault_member |
| `asset` | Get single asset detail + usage count | vault_member |

### Write Endpoints (POST) — `vault-dashboard.js`

| Action | Description | Permission |
|--------|-------------|------------|
| `save-template` | Create or update template (upsert by ID) | vault_member (own) or vault_approve |
| `save-draft` | Create or update draft | vault_member (own) or vault_approve |
| `submit-for-review` | Change status to pending_review | vault_member (own) |
| `approve` | Approve template or draft | vault_approve |
| `reject` | Reject with optional feedback (stores `rejection_reason`) | vault_approve |
| `archive-template` | Archive an approved template | vault_approve |
| `delete-asset` | Remove asset from R2 + DB | vault_approve |

### Upload Endpoints (POST) — `vault-dashboard-upload.js`

| Action | Description | Permission |
|--------|-------------|------------|
| `upload-asset` | Upload image to R2 + create asset record | vault_member |
| `export-thumbnail` | Upload generated PNG thumbnail to R2 | vault_member |

---

## Frontend File Structure

```
src/pages/vault-dashboard/
  VaultDashboardPage.jsx          — Route entry, tab state
  CardCreator.jsx                 — Main editor (two-panel layout, top bar, status bar)
  TemplatesPage.jsx               — Template browser/manager
  DraftsPage.jsx                  — Review queue
  AssetsPage.jsx                  — Asset library page

src/pages/vault-dashboard/editor/
  TemplateModeControls.jsx        — Left panel for template mode
  FullArtModeControls.jsx         — Left panel for full art mode
  LayerStackPanel.jsx             — Draggable layer list
  LayerProperties.jsx             — Properties panel (delegates to type-specific)
  ImageLayerProps.jsx             — Image layer property controls
  EffectLayerProps.jsx            — Effect layer property controls
  FrameLayerProps.jsx             — Frame layer property controls
  TextLayerProps.jsx              — Text layer property controls
  AssetPickerModal.jsx            — Inline asset browser/uploader

src/pages/vault-dashboard/preview/
  CardPreview.jsx                 — Live preview wrapper (zoom, debug outlines)
  FullArtRenderer.jsx             — DOM-based layer stack renderer
  TemplateRenderer.jsx            — Extended TradingCard for template mode
  ExportCanvas.jsx                — PNG export logic

src/components/layout/
  VaultDashboardLayout.jsx        — Navbar + Outlet wrapper
  VaultDashboardNavbar.jsx        — Tab navigation

src/services/api/
  vault-dashboard.js              — API client (templates, drafts, assets CRUD)
```

### Backend

```
functions/api/
  vault-dashboard.js              — JSON endpoints (adapt() wrapped)
  vault-dashboard-upload.js       — File upload (raw onRequest, like codex-upload.js)

database/migrations/
  101-vault-dashboard.sql         — New tables, indexes, vault_member + vault_approve permissions
```

### Existing File Changes

```
functions/lib/r2.js               — Add 'vault-assets/' to ALLOWED_PREFIXES
functions/lib/vault.js            — Add full_art to RARITIES (NOT to RARITY_ORDER)
src/services/database.js          — Add vaultDashboardService export
src/components/layout/AdminNavbar.jsx — Add Vault Dashboard to morePages
```

---

## Integration with Existing Systems

### Card Generation

Approved templates integrate with the existing card system:

- When generating cards via `cardclash_manage` admin tools, approved templates appear as an option
- Migration adds: `ALTER TABLE cc_cards ADD COLUMN template_id INTEGER REFERENCES cc_card_templates(id) ON DELETE SET NULL`
- The existing `card_data` JSONB column on `cc_cards` (already used by pack opening) stores a **snapshot** of `template_data` at mint time (template edits do NOT retroactively change existing cards)
- When minting a card from a template, the system copies `template_data` into the existing `card_data` column and sets `template_id`

### Full Art Card Rendering

Cards with rarity `full_art` render differently throughout the app:

- Collection, marketplace, trading views check `rarity === 'full_art'` to switch rendering
- Instead of the standard `TradingCard` layout, they use `FullArtRenderer` with the card's `card_data` layer stack
- Holo effects use existing CSS classes, extended with new Full Art-specific effects
- If `card_data` is missing (shouldn't happen), falls back to standard `TradingCard` rendering

### Existing Vault Admin

No changes to `/admin/vault`. The card creator is additive — it produces templates and drafts that feed into the existing card generation pipeline.

---

## Out of Scope

- Animated card effects (GIF/video export) — static PNG only for v1
- Card template versioning/history — single current version per template
- Collaborative editing — one editor at a time
- AI-assisted card generation — manual design only
- Mobile editor — desktop-first, responsive viewing but editing is desktop

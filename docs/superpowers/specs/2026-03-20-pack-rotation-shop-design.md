# Pack Rotation Shop Design

## Summary

Split the Shop tab into two sections: **Regular Packs** (existing league packs) and **Special Rotation** (daily-rotating selection of themed/division packs). Admin controls which packs appear on which dates. Rotation changes at midnight UTC with a visible countdown.

## Database

### New Table: `cc_pack_rotation_schedule`

```sql
CREATE TABLE cc_pack_rotation_schedule (
  date        DATE NOT NULL,
  pack_type_id TEXT NOT NULL REFERENCES cc_pack_types(id) ON DELETE CASCADE,
  PRIMARY KEY (date, pack_type_id)
);
CREATE INDEX idx_rotation_schedule_date ON cc_pack_rotation_schedule(date DESC);
```

Resolution logic (subquery to get all packs for the effective date):
```sql
SELECT pack_type_id FROM cc_pack_rotation_schedule
WHERE date = (SELECT MAX(date) FROM cc_pack_rotation_schedule WHERE date <= CURRENT_DATE)
```
If no rows exist, rotation section is empty.

### New Pack Types (seeded via migration)

**Gods Pack** (`gods-only`):
- 6 cards, 70 Cores, all god slots
- Same rarity structure as league packs (1 uncommon+ slot, standard rarity rolls)

**Items Pack** (`items-only`):
- 6 cards, 70 Cores, all item slots
- Same rarity structure as league packs

**Division Packs** (created dynamically from divisions table):
- ID pattern: `div-{league_slug}-{division_slug}` (e.g., `div-osl-athens`)
- 6 cards, 15 Cores
- Same slot structure as league packs but `division_ids` scoped to that division
- Group constraint: `{ type: 'player', min: 1, max: 3 }` — guarantees 1-3 player cards from that division

All new packs created as `enabled = true` with `rotation_only = true`. This new boolean column on `cc_pack_types` distinguishes rotation packs from regular shop packs. The frontend filters: regular packs = `leagueId && !rotationOnly`, rotation packs = only those in today's `rotationPacks` array.

Backend enforcement: `open-pack` will validate that rotation-only packs can only be purchased when they're in the current rotation schedule.

## Backend API

### Vault Load Changes

The existing `load` action in `vault.js` will also return the current rotation packs:

```js
// Added to handleLoad response
rotationPacks: [...] // array of pack_type_ids in today's rotation
rotationDate: '2026-03-20' // effective date (for carry-over awareness)
```

Query: find max date <= UTC today from `cc_pack_rotation_schedule`, return all pack_type_ids for that date.

### New Admin Endpoint: `functions/api/rotation-manage.js`

Permission: `permission_manage` (global only)

**GET actions:**
- `load` — returns all scheduled dates with their packs, plus all available pack types for picker

**POST actions:**
- `set-date` — set packs for a specific date: `{ date, packTypeIds: [...] }`
- `remove-date` — remove a date from schedule: `{ date }`

## Frontend: Shop UI Changes

### PackShop component (CCPackShop.jsx)

Split into two sections within the existing Shop tab:

1. **Regular Packs** — existing league packs (OSL, BSL) with current showcase UI unchanged
2. **Special Rotation** section below, with:
   - Section header: "SPECIAL ROTATION" with countdown to midnight UTC
   - Grid of rotation pack cards (similar to pack showcase but in a scrollable grid)
   - Each pack is clickable to focus/buy (reuse existing pack interaction pattern)
   - If no rotation active, section hidden

### Countdown Timer

Same pattern as the daily claim countdown — compute time until next midnight UTC, update every second. Display format: `12h 34m 56s`.

### Mobile

Rotation packs shown as horizontal snap-scroll below the regular pack scroll, with its own dot indicators and section header.

## Frontend: Admin UI

### New Page: `src/pages/admin/RotationManager.jsx`

Calendar-style interface:
- Date picker to select/navigate dates
- For each date, pick which packs to include from a dropdown/checklist of all enabled pack types
- Visual timeline showing upcoming scheduled rotations
- "Today" indicator showing what's currently live
- Quick actions: copy a day's rotation to another date, clear a date

### Admin Integration
- Route: `/admin/rotation` with `permission_manage` gate
- Added to AdminNavbar `morePages` and AdminLanding tools grid

## Data Flow

1. Admin schedules packs for dates via Rotation Manager
2. User opens vault → `load` query includes `rotationPacks` for today
3. PackShop renders regular packs + rotation section
4. Countdown ticks to midnight UTC
5. At midnight, next page load fetches new rotation (no WebSocket needed — resolved at query time)
6. If no new date scheduled, last scheduled date carries over

## Pack Type Details

### Gods Pack Slots
```json
[
  { "types": ["god"], "minRarity": "common" },
  { "types": ["god"], "minRarity": "common" },
  { "types": ["god"], "minRarity": "common" },
  { "types": ["god"], "minRarity": "uncommon" },
  { "types": ["god"], "minRarity": "common" },
  { "types": ["god"], "minRarity": "common" }
]
```

### Items Pack Slots
```json
[
  { "types": ["item"], "minRarity": "common" },
  { "types": ["item"], "minRarity": "common" },
  { "types": ["item"], "minRarity": "common" },
  { "types": ["item"], "minRarity": "uncommon" },
  { "types": ["item"], "minRarity": "common" },
  { "types": ["item"], "minRarity": "common" }
]
```

### Division Pack Slots (same structure as league packs)
Uses same slot config as the corresponding league pack but with `division_ids` set to just that division's ID. Group constraint `player: { min: 1, max: 3 }` ensures 1-3 player cards from the division pool.

## Files Touched

- `database/migrations/XXX-pack-rotation.sql` — new table + pack type seeds
- `functions/api/vault.js` — add rotation query to load
- `functions/api/rotation-manage.js` — new admin endpoint
- `src/pages/vault/CCPackShop.jsx` — split shop into sections + countdown
- `src/pages/vault/VaultContext.jsx` — expose rotation data
- `src/pages/admin/RotationManager.jsx` — new admin page
- `src/App.jsx` — add rotation admin route
- `src/components/layout/AdminNavbar.jsx` — add nav entry
- `src/pages/admin/AdminLanding.jsx` — add tool card
- `src/services/database.js` — add rotationService

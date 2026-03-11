# Pack Creator Admin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panel to create fully configurable pack types with per-slot card type/rarity constraints, flexible division-based player pools, and cosmetic settings — plus a backend generator that reads slot config instead of hardcoded logic.

**Architecture:** Add `slots` JSONB, `division_ids` INTEGER[], and `color` TEXT columns to `cc_pack_types`. New `generateConfiguredPack()` function reads slot config at pack-open time, replacing hardcoded `generateMixedPack`/`generateRarityPack` for packs that have `slots` defined. Admin UI at `/admin/pack-creator` (permission_manage) provides a slot builder with type checkboxes, weight inputs, rarity dropdowns, and a grouped division multi-select.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `database/migrations/087-pack-types-slots.sql` | Create | Add `slots`, `division_ids`, `color` columns to `cc_pack_types` |
| `functions/api/pack-creator.js` | Create | Admin CRUD endpoint for pack types (permission_manage) |
| `functions/lib/vault.js` | Modify | Add `generateConfiguredPack()`, update `openPack()` routing, add `generatePlayerCardByDivisions()` |
| `src/pages/admin/PackCreator.jsx` | Create | Admin page: list pack types, create/edit form with slot builder |
| `src/services/database.js` | Modify | Add `packCreatorService` |
| `src/App.jsx` | Modify | Import + route |
| `src/pages/admin/AdminLanding.jsx` | Modify | Add card |

---

## Chunk 1: Database Migration + Backend API

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/087-pack-types-slots.sql`

- [ ] **Step 1: Write migration**

```sql
-- Add configurable slot definitions, division filtering, and cosmetic color to pack types
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS slots JSONB;
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS division_ids INTEGER[];
ALTER TABLE cc_pack_types ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN cc_pack_types.slots IS 'Array of slot configs: [{types, typeWeights, minRarity, maxRarity}]. NULL = use legacy category-based generation.';
COMMENT ON COLUMN cc_pack_types.division_ids IS 'Division IDs for player card pool. Empty/NULL = all divisions.';
COMMENT ON COLUMN cc_pack_types.color IS 'Hex color for pack art and UI theming.';
```

- [ ] **Step 2: Run migration against dev database**

Run: `psql $DATABASE_URL -f database/migrations/087-pack-types-slots.sql`
Expected: ALTER TABLE x3, COMMENT x3

---

### Task 2: Backend Pack Generator

**Files:**
- Modify: `functions/lib/vault.js`

The key change: add `generateConfiguredPack(sql, pack)` that reads `pack.slots` JSONB and generates cards per-slot. Also add `generatePlayerCardByDivisions(sql, rarity, divisionIds)` for division-filtered player cards.

- [ ] **Step 1: Add `generatePlayerCardByDivisions` function**

Add after the existing `generatePlayerCardLegacy` function (after line 299), before `generateCardByType`:

```javascript
async function generatePlayerCardByDivisions(sql, rarity, divisionIds) {
  if (!divisionIds?.length) {
    return generatePlayerCard(sql, rarity, null)
  }
  const defs = await sql`
    SELECT * FROM cc_player_defs WHERE division_id = ANY(${divisionIds}) ORDER BY RANDOM() LIMIT 1
  `
  if (!defs[0]) {
    return generatePlayerCard(sql, rarity, null)
  }

  const def = defs[0]
  const stats = def.frozen_stats || await computePlayerStats(sql, def.player_id, def.team_id, def.season_id)
  const role = (def.role || 'adc').toUpperCase()

  let avatarUrl = null
  const [prefRow] = await sql`
    SELECT u.discord_id, u.discord_avatar,
           COALESCE(up.allow_discord_avatar, true) AS allow_avatar
    FROM users u
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE u.linked_player_id = ${def.player_id}
  `
  if (prefRow?.allow_avatar && prefRow.discord_id && prefRow.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${prefRow.discord_id}/${prefRow.discord_avatar}.webp?size=256`
  }
  if (!avatarUrl && stats.bestGod) {
    const slug = stats.bestGod.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    avatarUrl = `https://smitebrain.com/cdn-cgi/image/width=256,height=256,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`
  }

  return {
    card_type: 'player',
    god_id: `player-${def.player_id}-t${def.team_id}`,
    god_name: def.player_name,
    god_class: role,
    role: role.toLowerCase(),
    rarity,
    serial_number: Math.floor(Math.random() * 9999) + 1,
    holo_effect: rollHoloEffect(rarity),
    holo_type: rollHoloType(rarity),
    image_url: avatarUrl || '',
    acquired_via: 'pack',
    def_id: def.id,
    card_data: {
      defId: def.id,
      playerId: def.player_id,
      teamName: def.team_name,
      teamColor: def.team_color || '#6366f1',
      seasonName: def.season_slug,
      leagueName: def.league_slug,
      divisionName: def.division_slug,
      role,
      stats,
      bestGod: stats.bestGod,
    },
  }
}
```

- [ ] **Step 2: Add `rollRarityBounded` helper**

Add after `rollRarity` (after line 27):

```javascript
function rollRarityBounded(minRarity = 'common', maxRarity = null) {
  if (!maxRarity) return rollRarity(minRarity)
  const minIdx = RARITY_ORDER.indexOf(minRarity)
  const maxIdx = RARITY_ORDER.indexOf(maxRarity)
  if (maxIdx < 0 || maxIdx < minIdx) return rollRarity(minRarity)
  const eligible = RARITY_ORDER.slice(minIdx, maxIdx + 1)
  const totalWeight = eligible.reduce((sum, r) => sum + RARITIES[r].dropRate, 0)
  let roll = Math.random() * totalWeight
  for (const r of eligible) {
    roll -= RARITIES[r].dropRate
    if (roll <= 0) return r
  }
  return eligible[eligible.length - 1]
}
```

- [ ] **Step 3: Add `generateConfiguredPack` function**

Add after `generateMixedPack` (after line 411):

```javascript
async function generateConfiguredPack(sql, pack) {
  const slots = pack.slots || []
  const divisionIds = pack.division_ids || []
  const cards = []

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const rarity = rollRarityBounded(slot.minRarity || 'common', slot.maxRarity || null)

    // Pick card type from allowed types, using weights if provided
    const types = slot.types || ['god']
    let type
    if (slot.typeWeights && Object.keys(slot.typeWeights).length > 0) {
      const totalWeight = types.reduce((sum, t) => sum + (slot.typeWeights[t] || 0), 0)
      let roll = Math.random() * totalWeight
      for (const t of types) {
        roll -= (slot.typeWeights[t] || 0)
        if (roll <= 0) { type = t; break }
      }
      if (!type) type = types[types.length - 1]
    } else {
      type = types[Math.floor(Math.random() * types.length)]
    }

    let card
    if (type === 'player') {
      card = divisionIds.length > 0
        ? await generatePlayerCardByDivisions(sql, rarity, divisionIds)
        : await generatePlayerCard(sql, rarity, pack.league_id)
    } else {
      card = generateCardByType(type, rarity)
    }
    card._revealOrder = i
    cards.push(card)
  }

  return cards
}
```

- [ ] **Step 4: Update `openPack` to route to configured generator**

Replace the card generation block in `openPack` (lines 346-351):

```javascript
  let cards
  if (pack.slots && pack.slots.length > 0) {
    cards = await generateConfiguredPack(sql, pack)
  } else if (pack.category === 'mixed') {
    cards = await generateMixedPack(sql, pack.league_id)
  } else {
    cards = generateRarityPack({ cards: pack.cards_per_pack, guarantees: pack.guarantees || [] })
  }
```

This is backwards-compatible: existing packs with `slots = NULL` use legacy logic.

- [ ] **Step 5: Verify dev server starts**

Run: `npm run dev:api`
Expected: Wrangler starts without errors

---

### Task 3: Backend Admin Endpoint

**Files:**
- Create: `functions/api/pack-creator.js`

- [ ] **Step 1: Create the endpoint**

```javascript
// Pack Creator Admin API — CRUD for cc_pack_types with slot configuration
// Permission: permission_manage (global only)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: adminHeaders, body: '' }
  }

  const user = await requirePermission(event, 'permission_manage')
  if (!user) {
    return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'load': return await handleLoad(sql)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create':  return await handleCreate(sql, body)
        case 'update':  return await handleUpdate(sql, body)
        case 'toggle':  return await handleToggle(sql, body)
        case 'delete':  return await handleDelete(sql, body)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('pack-creator error:', error)
    return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load all pack types + divisions for picker ═══
async function handleLoad(sql) {
  const [packTypes, divisions] = await Promise.all([
    sql`SELECT * FROM cc_pack_types ORDER BY sort_order, created_at`,
    sql`
      SELECT d.id, d.name, d.tier, d.slug, l.id AS league_id, l.name AS league_name, l.slug AS league_slug
      FROM divisions d
      JOIN leagues l ON l.id = d.league_id
      ORDER BY l.name, d.tier, d.name
    `,
  ])

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      packTypes: packTypes.map(formatPackType),
      divisions: divisions.map(d => ({
        id: d.id,
        name: d.name,
        tier: d.tier,
        slug: d.slug,
        leagueId: d.league_id,
        leagueName: d.league_name,
        leagueSlug: d.league_slug,
      })),
    }),
  }
}

// ═══ POST: Create new pack type ═══
async function handleCreate(sql, body) {
  const { id, name, description, cost, cardsPerPack, category, slots, divisionIds, color, guarantees, sortOrder } = body
  if (!id || !name) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id and name required' }) }
  }

  // Validate id is url-safe
  if (!/^[a-z0-9-]+$/.test(id)) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id must be lowercase alphanumeric with dashes' }) }
  }

  const [existing] = await sql`SELECT 1 FROM cc_pack_types WHERE id = ${id}`
  if (existing) {
    return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type ID already exists' }) }
  }

  const [row] = await sql`
    INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, guarantees, slots, division_ids, color, sort_order, enabled)
    VALUES (
      ${id}, ${name}, ${description || null}, ${cost || 0},
      ${cardsPerPack || (slots?.length || 6)}, ${category || 'configured'},
      ${guarantees ? JSON.stringify(guarantees) : '[]'},
      ${slots ? JSON.stringify(slots) : null},
      ${divisionIds?.length ? divisionIds : null},
      ${color || null}, ${sortOrder || 0}, false
    )
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Update existing pack type ═══
async function handleUpdate(sql, body) {
  const { id, name, description, cost, cardsPerPack, category, slots, divisionIds, color, guarantees, sortOrder } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [existing] = await sql`SELECT * FROM cc_pack_types WHERE id = ${id}`
  if (!existing) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type not found' }) }

  const [row] = await sql`
    UPDATE cc_pack_types SET
      name = ${name || existing.name},
      description = ${description !== undefined ? description : existing.description},
      cost = ${cost != null ? cost : existing.cost},
      cards_per_pack = ${cardsPerPack || (slots?.length || existing.cards_per_pack)},
      category = ${category || existing.category},
      guarantees = ${guarantees ? JSON.stringify(guarantees) : (existing.guarantees ? JSON.stringify(existing.guarantees) : '[]')},
      slots = ${slots ? JSON.stringify(slots) : (slots === null ? null : existing.slots ? JSON.stringify(existing.slots) : null)},
      division_ids = ${divisionIds !== undefined ? (divisionIds?.length ? divisionIds : null) : existing.division_ids},
      color = ${color !== undefined ? color : existing.color},
      sort_order = ${sortOrder != null ? sortOrder : existing.sort_order}
    WHERE id = ${id}
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Toggle enabled ═══
async function handleToggle(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [row] = await sql`
    UPDATE cc_pack_types SET enabled = NOT enabled WHERE id = ${id} RETURNING *
  `
  if (!row) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type not found' }) }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Delete ═══
async function handleDelete(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  // Don't allow deleting packs that have sales
  const [hasSales] = await sql`SELECT 1 FROM cc_pack_sales WHERE pack_type_id = ${id} LIMIT 1`
  if (hasSales) {
    return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot delete pack type that has sale listings. Remove sales first.' }) }
  }

  await sql`DELETE FROM cc_pack_types WHERE id = ${id}`
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ deleted: true }) }
}

function formatPackType(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cost: row.cost,
    cardsPerPack: row.cards_per_pack,
    category: row.category,
    guarantees: row.guarantees || [],
    slots: row.slots || null,
    divisionIds: row.division_ids || [],
    leagueId: row.league_id,
    color: row.color,
    sortOrder: row.sort_order,
    enabled: row.enabled,
    createdAt: row.created_at,
  }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Verify endpoint loads**

Run: `npm run dev:api`
Expected: No errors

---

## Chunk 2: Frontend Admin UI + Wiring

### Task 4: Service Layer

**Files:**
- Modify: `src/services/database.js`

- [ ] **Step 1: Add `packCreatorService`**

Add right before `vendingRestockService`:

```javascript
export const packCreatorService = {
    async load() {
        return apiCall('pack-creator', { action: 'load' })
    },
    async create(data) {
        return apiPost('pack-creator', { action: 'create' }, data)
    },
    async update(data) {
        return apiPost('pack-creator', { action: 'update' }, data)
    },
    async toggle(id) {
        return apiPost('pack-creator', { action: 'toggle' }, { id })
    },
    async delete(id) {
        return apiPost('pack-creator', { action: 'delete' }, { id })
    },
}
```

---

### Task 5: Admin Page — PackCreator.jsx

**Files:**
- Create: `src/pages/admin/PackCreator.jsx`

This is the largest file. It contains:
1. Pack type list with enable/disable/delete
2. Create/edit form with:
   - Basic fields: id, name, description, cost, color
   - Division multi-select grouped by league
   - Slot builder: add/remove slots, each with type checkboxes, optional weights, min/max rarity dropdowns
3. Preview summary

- [ ] **Step 1: Create PackCreator.jsx**

```jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import PageTitle from '../../components/PageTitle'
import { packCreatorService } from '../../services/database'

const CARD_TYPES = ['god', 'item', 'consumable', 'player']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_COLORS = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#ff8c00', mythic: '#ef4444',
}

const DEFAULT_SLOT = { types: ['god', 'item', 'consumable'], typeWeights: {}, minRarity: 'common', maxRarity: null }

function SlotEditor({ slot, index, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const updateField = (field, value) => onChange({ ...slot, [field]: value })

  const toggleType = (type) => {
    const types = slot.types.includes(type)
      ? slot.types.filter(t => t !== type)
      : [...slot.types, type]
    if (types.length === 0) return
    // Clean weights for removed types
    const weights = { ...slot.typeWeights }
    Object.keys(weights).forEach(k => { if (!types.includes(k)) delete weights[k] })
    onChange({ ...slot, types, typeWeights: weights })
  }

  const setWeight = (type, value) => {
    const weights = { ...slot.typeWeights, [type]: parseInt(value) || 0 }
    if (weights[type] <= 0) delete weights[type]
    updateField('typeWeights', weights)
  }

  const hasWeights = Object.keys(slot.typeWeights || {}).length > 0

  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30 font-mono w-8">#{index + 1}</span>
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} disabled={isFirst} className="text-white/20 hover:text-white/50 disabled:opacity-30 cursor-pointer text-xs px-1">^</button>
            <button onClick={onMoveDown} disabled={isLast} className="text-white/20 hover:text-white/50 disabled:opacity-30 cursor-pointer text-xs px-1">v</button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onDuplicate} className="text-xs text-blue-400/60 hover:text-blue-400 cursor-pointer px-1">Dupe</button>
          <button onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 cursor-pointer px-1">Remove</button>
        </div>
      </div>

      {/* Card types */}
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Card Types</div>
        <div className="flex flex-wrap gap-1.5">
          {CARD_TYPES.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                slot.types.includes(type)
                  ? 'bg-white/15 text-white border border-white/30'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:border-white/15'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Type weights (only if >1 type selected) */}
      {slot.types.length > 1 && (
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Weights</div>
            <span className="text-[10px] text-white/20">{hasWeights ? 'custom' : 'equal chance'}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {slot.types.map(type => (
              <div key={type} className="flex items-center gap-1">
                <span className="text-[10px] text-white/40 w-14">{type}</span>
                <input
                  type="number"
                  min="0"
                  value={slot.typeWeights?.[type] || ''}
                  onChange={e => setWeight(type, e.target.value)}
                  placeholder="—"
                  className="w-12 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-white text-center"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rarity range */}
      <div className="flex gap-3">
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Min Rarity</div>
          <select
            value={slot.minRarity || 'common'}
            onChange={e => updateField('minRarity', e.target.value)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white"
          >
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Max Rarity</div>
          <select
            value={slot.maxRarity || ''}
            onChange={e => updateField('maxRarity', e.target.value || null)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white"
          >
            <option value="">No cap</option>
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function DivisionPicker({ divisions, selected, onChange }) {
  // Group divisions by league
  const grouped = useMemo(() => {
    const map = {}
    for (const d of divisions) {
      if (!map[d.leagueId]) map[d.leagueId] = { leagueName: d.leagueName, divisions: [] }
      map[d.leagueId].divisions.push(d)
    }
    return Object.entries(map)
  }, [divisions])

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(d => d !== id) : [...selected, id])
  }

  const toggleLeague = (leagueId) => {
    const leagueDivs = divisions.filter(d => d.leagueId === leagueId).map(d => d.id)
    const allSelected = leagueDivs.every(id => selected.includes(id))
    if (allSelected) {
      onChange(selected.filter(id => !leagueDivs.includes(id)))
    } else {
      onChange([...new Set([...selected, ...leagueDivs])])
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">Player Pool — Divisions {selected.length > 0 ? `(${selected.length} selected)` : '(all)'}</div>
      {selected.length === 0 && (
        <div className="text-xs text-white/30 italic">No filter — player cards pull from all divisions</div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {grouped.map(([leagueId, { leagueName, divisions: divs }]) => {
          const allSelected = divs.every(d => selected.includes(d.id))
          const someSelected = divs.some(d => selected.includes(d.id))
          return (
            <div key={leagueId}>
              <button
                onClick={() => toggleLeague(parseInt(leagueId))}
                className={`text-xs font-semibold mb-0.5 cursor-pointer transition-colors ${
                  allSelected ? 'text-amber-400' : someSelected ? 'text-amber-400/60' : 'text-white/50 hover:text-white/70'
                }`}
              >
                {allSelected ? '[-]' : someSelected ? '[~]' : '[+]'} {leagueName}
              </button>
              <div className="flex flex-wrap gap-1 ml-3">
                {divs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      selected.includes(d.id)
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-white/[0.03] text-white/30 border border-white/5 hover:border-white/15'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {selected.length > 0 && (
        <button onClick={() => onChange([])} className="text-[10px] text-white/30 hover:text-white/50 cursor-pointer underline">
          Clear filter (use all divisions)
        </button>
      )}
    </div>
  )
}

function PackForm({ initial, divisions, onSave, onCancel, saving }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    id: initial?.id || '',
    name: initial?.name || '',
    description: initial?.description || '',
    cost: initial?.cost ?? '',
    color: initial?.color || '#d2b138',
    divisionIds: initial?.divisionIds || [],
    slots: initial?.slots || [{ ...DEFAULT_SLOT }],
    sortOrder: initial?.sortOrder ?? 0,
  })

  const updateSlot = (index, updated) => {
    const slots = [...form.slots]
    slots[index] = updated
    setForm(f => ({ ...f, slots }))
  }
  const removeSlot = (index) => setForm(f => ({ ...f, slots: f.slots.filter((_, i) => i !== index) }))
  const addSlot = () => setForm(f => ({ ...f, slots: [...f.slots, { ...DEFAULT_SLOT }] }))
  const duplicateSlot = (index) => {
    const slots = [...form.slots]
    slots.splice(index + 1, 0, { ...JSON.parse(JSON.stringify(slots[index])) })
    setForm(f => ({ ...f, slots }))
  }
  const moveSlot = (index, dir) => {
    const slots = [...form.slots]
    const target = index + dir
    if (target < 0 || target >= slots.length) return
    ;[slots[index], slots[target]] = [slots[target], slots[index]]
    setForm(f => ({ ...f, slots }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...form,
      cost: parseInt(form.cost) || 0,
      cardsPerPack: form.slots.length,
      category: 'configured',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">ID (slug)</label>
          <input
            value={form.id}
            onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            disabled={isEdit}
            placeholder="my-custom-pack"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white disabled:opacity-50"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Custom Pack"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Cost (Cores)</label>
          <input
            type="number"
            min="0"
            value={form.cost}
            onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="flex-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Description</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Optional description"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
        />
      </div>

      {/* Division picker */}
      <DivisionPicker
        divisions={divisions}
        selected={form.divisionIds}
        onChange={ids => setForm(f => ({ ...f, divisionIds: ids }))}
      />

      {/* Slot builder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Slots ({form.slots.length} cards)
          </div>
          <button type="button" onClick={addSlot} className="text-xs text-green-400 hover:text-green-300 cursor-pointer">
            + Add Slot
          </button>
        </div>
        <div className="space-y-2">
          {form.slots.map((slot, i) => (
            <SlotEditor
              key={i}
              slot={slot}
              index={i}
              onChange={s => updateSlot(i, s)}
              onRemove={() => removeSlot(i)}
              onDuplicate={() => duplicateSlot(i)}
              onMoveUp={() => moveSlot(i, -1)}
              onMoveDown={() => moveSlot(i, 1)}
              isFirst={i === 0}
              isLast={i === form.slots.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Preview</div>
        <div className="text-xs text-white/60 space-y-0.5">
          <div><span className="text-white font-medium">{form.name || '(unnamed)'}</span> — {form.slots.length} cards, {form.cost || 0} Cores</div>
          {form.divisionIds.length > 0 && (
            <div>Player pool: {form.divisionIds.length} division{form.divisionIds.length !== 1 ? 's' : ''}</div>
          )}
          {form.slots.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-white/30 font-mono w-6">#{i+1}</span>
              <span>{s.types.join('/')}</span>
              <span style={{ color: RARITY_COLORS[s.minRarity] }}>{s.minRarity}+</span>
              {s.maxRarity && <span className="text-white/30">cap: <span style={{ color: RARITY_COLORS[s.maxRarity] }}>{s.maxRarity}</span></span>}
              {Object.keys(s.typeWeights || {}).length > 0 && <span className="text-white/20">(weighted)</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving || !form.id || !form.name || form.slots.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Pack Type' : 'Create Pack Type'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PackCreator() {
  const [packTypes, setPackTypes] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // null | 'create' | packId (edit)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await packCreatorService.load()
      setPackTypes(data.packTypes)
      setDivisions(data.divisions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const result = await packCreatorService.create(data)
        setPackTypes(prev => [...prev, result.packType])
      } else {
        const result = await packCreatorService.update(data)
        setPackTypes(prev => prev.map(p => p.id === data.id ? result.packType : p))
      }
      setMode(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      const data = await packCreatorService.toggle(id)
      setPackTypes(prev => prev.map(p => p.id === id ? data.packType : p))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(`Delete pack type "${id}"? This cannot be undone.`)) return
    try {
      await packCreatorService.delete(id)
      setPackTypes(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const editingPack = mode && mode !== 'create' ? packTypes.find(p => p.id === mode) : null

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-3xl mx-auto pb-8 px-4">
      <PageTitle title="Pack Creator" noindex />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Pack Creator</h1>
        {!mode && (
          <button
            onClick={() => setMode('create')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer"
          >
            + New Pack Type
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Create / Edit form */}
      {mode && (
        <div className="mb-6">
          <PackForm
            initial={editingPack}
            divisions={divisions}
            onSave={handleSave}
            onCancel={() => setMode(null)}
            saving={saving}
          />
        </div>
      )}

      {/* Pack types list */}
      <div className="space-y-2">
        {packTypes.map(pt => (
          <div
            key={pt.id}
            className={`p-4 rounded-xl border transition-colors ${
              pt.enabled
                ? 'bg-white/5 border-white/10'
                : 'bg-white/[0.02] border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Color swatch */}
              {pt.color && (
                <div className="w-3 h-8 rounded-full shrink-0" style={{ background: pt.color }} />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{pt.name}</span>
                  <span className="text-xs text-white/20 font-mono">{pt.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                    pt.enabled ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {pt.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 uppercase tracking-wider">
                    {pt.slots ? 'configured' : pt.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                  <span>{pt.cardsPerPack} cards</span>
                  <span>{pt.cost} Cores</span>
                  {pt.divisionIds?.length > 0 && <span>{pt.divisionIds.length} div{pt.divisionIds.length !== 1 ? 's' : ''}</span>}
                  {pt.slots && <span>{pt.slots.length} slots configured</span>}
                  {!pt.slots && pt.guarantees?.length > 0 && (
                    <span>{pt.guarantees.map(g => `${g.count}x ${g.minRarity}+`).join(', ')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setMode(pt.id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggle(pt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    pt.enabled
                      ? 'text-white/50 bg-white/5 hover:bg-white/10'
                      : 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  }`}
                >
                  {pt.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(pt.id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Task 6: App Wiring

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/admin/AdminLanding.jsx`

- [ ] **Step 1: Add import and route in App.jsx**

Add import near other admin imports:
```javascript
import PackCreator from "./pages/admin/PackCreator.jsx";
```

Add route after the vending-restock route:
```jsx
<Route path="pack-creator" element={<ProtectedRoute requiredPermission="permission_manage"><PackCreator /></ProtectedRoute>} />
```

- [ ] **Step 2: Add card in AdminLanding.jsx**

Add a new tool entry after the Vending Restock card:
```javascript
{
    title: 'Pack Creator',
    description: 'Create and configure pack types with per-slot card type and rarity constraints, weighted probabilities, division-based player pools, and custom colors.',
    path: '/admin/pack-creator',
    permission: 'permission_manage',
    icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
    ),
    accent: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/20 hover:border-orange-500/40',
    iconColor: 'text-orange-400',
    btnClass: 'bg-orange-600 hover:bg-orange-700',
},
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build --logLevel error`
Expected: Clean build, no errors

---

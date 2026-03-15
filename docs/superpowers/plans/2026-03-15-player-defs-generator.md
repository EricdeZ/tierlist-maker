# Player Defs Generator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Player Defs" tab to Vault Admin that previews all player-team-season combos, lets the admin approve/skip/permanently exclude each, then generates only the approved ones.

**Architecture:** New `preview-player-defs` API action returns dry-run data without writing. New `cc_player_def_exclusions` table stores permanent exclusions. Frontend tab shows season selector + preview table with per-row skip/exclude controls and bulk "Generate Selected" action.

**Tech Stack:** React (existing vault admin patterns), Cloudflare Pages Functions, Neon PostgreSQL

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `database/migrations/116-player-def-exclusions.sql` | Exclusions table |
| Modify | `functions/api/vault-admin.js` | 4 new actions: preview-player-defs, generate-selected-defs, exclude-player-def, unexclude-player-def |
| Modify | `functions/lib/vault-defs.js` | New `previewPlayerDefs()` + `generateSelectedDefs()` functions |
| Modify | `src/services/database.js` | 4 new service methods on `vaultAdminService` |
| Create | `src/pages/admin/vault/CCAdminPlayerDefs.jsx` | Player Defs tab component |
| Modify | `src/pages/admin/VaultAdmin.jsx` | Add Player Defs tab to TABS array + render |

---

## Chunk 1: Backend — Migration + Preview API

### Task 1: Create exclusions table migration

**Files:**
- Create: `database/migrations/116-player-def-exclusions.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS cc_player_def_exclusions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  excluded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, team_id, season_id)
);
```

- [ ] **Step 2: Run migration against dev database**

```bash
# Apply via wrangler or direct psql — follow existing migration pattern
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/116-player-def-exclusions.sql
git commit -m "feat(vault): add cc_player_def_exclusions table"
```

### Task 2: Add `previewPlayerDefs` to vault-defs.js

**Files:**
- Modify: `functions/lib/vault-defs.js:88-260`

This function reuses the same player-team discovery logic from `generatePlayerDefs` but returns preview data instead of writing. It also checks existing defs and exclusions to set a `status` field on each entry.

- [ ] **Step 1: Add `previewPlayerDefs` function**

Add after the `computePlayerStats` function (after line 79), before `generatePlayerDefs`. The function:

1. Accepts `(sql, seasonIds)` — array of season IDs
2. For each season, runs the same player/team discovery (current league_players + roster_transactions) as `generatePlayerDefs` lines 90-180
3. For each player-team-season combo, checks:
   - `cc_player_defs` → exists? → status `'exists'`
   - `cc_player_def_exclusions` → excluded? → status `'excluded'`
   - Neither → status `'new'`
4. Returns flat array: `[{ playerId, playerName, teamId, teamName, teamColor, role, seasonId, seasonName, leagueSlug, divisionSlug, bestGodName, status }]`

Key: extract the shared player-team discovery from `generatePlayerDefs` into a private helper `discoverPlayerTeamCombos(sql, seasonId)` that both functions call. This avoids duplicating the 90-line discovery block.

```javascript
// Private helper — shared by preview + generate
async function discoverPlayerTeamCombos(sql, seasonId) {
  const [season] = await sql`
    SELECT s.id, s.name, s.slug, s.is_active,
           d.id AS division_id, d.slug AS division_slug, d.tier AS division_tier,
           l.id AS league_id, l.slug AS league_slug
    FROM seasons s
    JOIN divisions d ON s.division_id = d.id
    JOIN leagues l ON d.league_id = l.id
    WHERE s.id = ${seasonId}
  `
  if (!season) throw new Error(`Season ${seasonId} not found`)

  const currentPlayers = await sql`
    SELECT lp.player_id, lp.team_id, lp.role,
           p.name AS player_name, p.slug AS player_slug,
           t.name AS team_name, t.color AS team_color
    FROM league_players lp
    JOIN players p ON p.id = lp.player_id
    LEFT JOIN teams t ON t.id = lp.team_id
    WHERE lp.season_id = ${seasonId}
      AND lp.team_id IS NOT NULL
  `

  const transactions = await sql`
    SELECT player_id, from_team_id, to_team_id, from_team_name, to_team_name, type, created_at
    FROM roster_transactions
    WHERE season_id = ${seasonId}
      AND type IN ('transfer', 'pickup', 'release')
    ORDER BY created_at ASC
  `

  const playerTeamMap = new Map()

  for (const p of currentPlayers) {
    const key = `${p.player_id}-${p.team_id}`
    playerTeamMap.set(key, {
      playerId: p.player_id,
      teamId: p.team_id,
      playerName: p.player_name,
      playerSlug: p.player_slug,
      teamName: p.team_name,
      teamColor: p.team_color,
      role: p.role,
    })
  }

  for (const tx of transactions) {
    if (tx.from_team_id && tx.type !== 'pickup') {
      const key = `${tx.player_id}-${tx.from_team_id}`
      if (!playerTeamMap.has(key)) {
        const [p] = await sql`SELECT p.name, p.slug FROM players p WHERE p.id = ${tx.player_id}`
        const [t] = await sql`SELECT t.name, t.color FROM teams t WHERE t.id = ${tx.from_team_id}`
        const [lp] = await sql`SELECT role FROM league_players WHERE player_id = ${tx.player_id} AND season_id = ${seasonId} LIMIT 1`
        if (p && t) {
          playerTeamMap.set(key, {
            playerId: tx.player_id,
            teamId: tx.from_team_id,
            playerName: p.name,
            playerSlug: p.slug,
            teamName: t.name,
            teamColor: t.color,
            role: lp?.role || null,
          })
        }
      }
    }
  }

  const entries = [...playerTeamMap.values()]
  entries.sort((a, b) => {
    const teamCmp = (a.teamName || '').localeCompare(b.teamName || '')
    if (teamCmp !== 0) return teamCmp
    return (a.playerName || '').localeCompare(b.playerName || '')
  })

  return { season, entries }
}
```

Then `previewPlayerDefs`:

```javascript
export async function previewPlayerDefs(sql, seasonIds) {
  const results = []

  for (const seasonId of seasonIds) {
    const { season, entries } = await discoverPlayerTeamCombos(sql, seasonId)

    // Batch-fetch existing defs and exclusions for this season
    const existingDefs = await sql`
      SELECT player_id, team_id FROM cc_player_defs WHERE season_id = ${seasonId}
    `
    const exclusions = await sql`
      SELECT player_id, team_id FROM cc_player_def_exclusions WHERE season_id = ${seasonId}
    `
    const defSet = new Set(existingDefs.map(d => `${d.player_id}-${d.team_id}`))
    const exclSet = new Set(exclusions.map(e => `${e.player_id}-${e.team_id}`))

    for (const e of entries) {
      const key = `${e.playerId}-${e.teamId}`

      // Best god (lightweight — just the name)
      const [bestGodRow] = await sql`
        SELECT pgs.god_played FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        WHERE lp.player_id = ${e.playerId} AND lp.season_id = ${seasonId}
          AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${e.teamId}
          AND pgs.god_played IS NOT NULL
        GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
      `

      let status = 'new'
      if (exclSet.has(key)) status = 'excluded'
      else if (defSet.has(key)) status = 'exists'

      results.push({
        playerId: e.playerId,
        playerName: e.playerName,
        teamId: e.teamId,
        teamName: e.teamName,
        teamColor: e.teamColor,
        role: e.role,
        seasonId,
        seasonName: season.name,
        leagueSlug: season.league_slug,
        divisionSlug: season.division_slug,
        bestGodName: bestGodRow?.god_played || null,
        status,
      })
    }
  }

  return results
}
```

- [ ] **Step 2: Refactor `generatePlayerDefs` to use `discoverPlayerTeamCombos`**

Replace lines 88-180 of the existing `generatePlayerDefs` with a call to `discoverPlayerTeamCombos`. The rest of the function (avatar lookup, upsert loop from line 183 onward) stays the same, just uses `{ season, entries }` from the helper.

- [ ] **Step 3: Add `generateSelectedDefs` function**

Similar to `generatePlayerDefs` but accepts an explicit list of `entries` `[{ playerId, teamId, seasonId }]` and only generates those. Reuses the same avatar/bestGod/upsert logic.

```javascript
export async function generateSelectedDefs(sql, entries) {
  let created = 0
  let updated = 0

  // Group entries by seasonId for efficient season lookups
  const bySeasonId = new Map()
  for (const e of entries) {
    if (!bySeasonId.has(e.seasonId)) bySeasonId.set(e.seasonId, [])
    bySeasonId.get(e.seasonId).push(e)
  }

  for (const [seasonId, seasonEntries] of bySeasonId) {
    const { season, entries: allEntries } = await discoverPlayerTeamCombos(sql, seasonId)

    // Filter to only requested entries
    const requestedKeys = new Set(seasonEntries.map(e => `${e.playerId}-${e.teamId}`))
    const filtered = allEntries.filter(e => requestedKeys.has(`${e.playerId}-${e.teamId}`))

    // Assign card_index across ALL entries in season (not just filtered)
    // so indices remain stable regardless of selection
    const indexMap = new Map()
    allEntries.forEach((e, i) => indexMap.set(`${e.playerId}-${e.teamId}`, i + 1))

    for (const e of filtered) {
      const cardIndex = indexMap.get(`${e.playerId}-${e.teamId}`)

      // Avatar URL
      let avatarUrl = null
      const [userRow] = await sql`
        SELECT u.discord_id, u.discord_avatar,
               COALESCE(up.allow_discord_avatar, true) AS allow_avatar
        FROM users u
        LEFT JOIN user_preferences up ON up.user_id = u.id
        WHERE u.linked_player_id = ${e.playerId}
      `
      if (userRow?.allow_avatar && userRow.discord_id && userRow.discord_avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${userRow.discord_id}/${userRow.discord_avatar}.webp?size=256`
      }

      // Best god name
      const [bestGodRow] = await sql`
        SELECT pgs.god_played FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        WHERE lp.player_id = ${e.playerId} AND lp.season_id = ${seasonId}
          AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${e.teamId}
          AND pgs.god_played IS NOT NULL
        GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
      `
      const bestGodName = bestGodRow?.god_played || null

      const [existing] = await sql`
        SELECT id FROM cc_player_defs
        WHERE player_id = ${e.playerId} AND team_id = ${e.teamId} AND season_id = ${seasonId}
      `

      if (existing) {
        await sql`
          UPDATE cc_player_defs SET
            player_name = ${e.playerName}, player_slug = ${e.playerSlug},
            team_name = ${e.teamName}, team_color = ${e.teamColor}, role = ${e.role},
            league_id = ${season.league_id}, league_slug = ${season.league_slug},
            division_id = ${season.division_id}, division_slug = ${season.division_slug},
            division_tier = ${season.division_tier}, season_slug = ${season.slug},
            card_index = ${cardIndex}, avatar_url = ${avatarUrl}, best_god_name = ${bestGodName},
            updated_at = NOW()
          WHERE id = ${existing.id}
        `
        updated++
      } else {
        await sql`
          INSERT INTO cc_player_defs (
            player_id, team_id, season_id, league_id, division_id,
            player_name, player_slug, team_name, team_color, role,
            league_slug, division_slug, season_slug, division_tier,
            card_index, avatar_url, best_god_name
          ) VALUES (
            ${e.playerId}, ${e.teamId}, ${seasonId}, ${season.league_id}, ${season.division_id},
            ${e.playerName}, ${e.playerSlug}, ${e.teamName}, ${e.teamColor}, ${e.role},
            ${season.league_slug}, ${season.division_slug}, ${season.slug}, ${season.division_tier},
            ${cardIndex}, ${avatarUrl}, ${bestGodName}
          )
        `
        created++
      }
    }
  }

  return { created, updated, total: created + updated }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/vault-defs.js
git commit -m "feat(vault): add previewPlayerDefs + generateSelectedDefs, extract shared discovery helper"
```

### Task 3: Add API actions to vault-admin.js

**Files:**
- Modify: `functions/api/vault-admin.js:8,27-34,38-54`

- [ ] **Step 1: Update imports**

At line 8, add `previewPlayerDefs` and `generateSelectedDefs` to the import:

```javascript
import { generatePlayerDefs, freezeSeasonStats, backfillCardDefs, previewPlayerDefs, generateSelectedDefs } from '../lib/vault-defs.js'
```

- [ ] **Step 2: Add GET `preview-player-defs` action**

In the GET switch (line 27-34), add:

```javascript
case 'preview-player-defs': return await handlePreviewPlayerDefs(sql, event.queryStringParameters)
```

Handler function:

```javascript
async function handlePreviewPlayerDefs(sql, params) {
  const { seasonIds, allActive } = params
  let ids = []

  if (allActive === 'true') {
    const rows = await sql`SELECT id FROM seasons WHERE is_active = true`
    ids = rows.map(r => r.id)
  } else if (seasonIds) {
    ids = seasonIds.split(',').map(Number).filter(Boolean)
  }

  if (!ids.length) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'seasonIds or allActive required' }) }
  }

  const entries = await previewPlayerDefs(sql, ids)
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ entries }) }
}
```

- [ ] **Step 3: Add POST actions for generate-selected, exclude, unexclude**

In the POST switch (lines 38-54), add three cases:

```javascript
case 'generate-selected-defs': return await handleGenerateSelectedDefs(sql, body)
case 'exclude-player-def':     return await handleExcludePlayerDef(sql, body, user)
case 'unexclude-player-def':   return await handleUnexcludePlayerDef(sql, body)
```

Handler functions:

```javascript
async function handleGenerateSelectedDefs(sql, body) {
  const { entries } = body
  if (!entries?.length) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'entries array required' }) }
  }
  const result = await generateSelectedDefs(sql, entries)
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(result) }
}

async function handleExcludePlayerDef(sql, body, user) {
  const { playerId, teamId, seasonId } = body
  if (!playerId || !teamId || !seasonId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'playerId, teamId, seasonId required' }) }
  }
  await sql`
    INSERT INTO cc_player_def_exclusions (player_id, team_id, season_id, excluded_by)
    VALUES (${playerId}, ${teamId}, ${seasonId}, ${user.discord_name || String(user.id)})
    ON CONFLICT (player_id, team_id, season_id) DO NOTHING
  `
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

async function handleUnexcludePlayerDef(sql, body) {
  const { playerId, teamId, seasonId } = body
  if (!playerId || !teamId || !seasonId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'playerId, teamId, seasonId required' }) }
  }
  await sql`
    DELETE FROM cc_player_def_exclusions
    WHERE player_id = ${playerId} AND team_id = ${teamId} AND season_id = ${seasonId}
  `
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/vault-admin.js
git commit -m "feat(vault): add preview/generate-selected/exclude/unexclude API actions"
```

### Task 4: Add frontend service methods

**Files:**
- Modify: `src/services/database.js:1283-1294`

- [ ] **Step 1: Add 4 new methods to `vaultAdminService`**

After `refreshBestGods` (line 1294), add:

```javascript
async previewPlayerDefs(params = {}) {
    return apiCall('vault-admin', { action: 'preview-player-defs', ...params })
},
async generateSelectedDefs(entries) {
    return apiPost('vault-admin', { action: 'generate-selected-defs' }, { entries })
},
async excludePlayerDef(playerId, teamId, seasonId) {
    return apiPost('vault-admin', { action: 'exclude-player-def' }, { playerId, teamId, seasonId })
},
async unexcludePlayerDef(playerId, teamId, seasonId) {
    return apiPost('vault-admin', { action: 'unexclude-player-def' }, { playerId, teamId, seasonId })
},
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault): add service methods for player def preview/generate/exclude"
```

---

## Chunk 2: Frontend — Player Defs Tab

### Task 5: Create CCAdminPlayerDefs component

**Files:**
- Create: `src/pages/admin/vault/CCAdminPlayerDefs.jsx`

This is the main component. It has two sections:

**Section 1: Season Selector**
- "All Active Seasons" button
- List of all seasons grouped by league, each with a checkbox
- "Preview" button

**Section 2: Preview Table** (shown after preview is fetched)
- Header row with select-all toggle + column labels
- One row per player-team-season combo showing: checkbox, player name, team (with color dot), role, season, best god, status badge, skip/exclude/unexclude button
- "Generate Selected" button at the bottom

- [ ] **Step 1: Create the component file**

```jsx
import { useState, useEffect, useMemo } from 'react'
import { vaultAdminService } from '../../../services/database'

export default function CCAdminPlayerDefs() {
  const [seasons, setSeasons] = useState([])
  const [selectedSeasons, setSelectedSeasons] = useState(new Set())
  const [entries, setEntries] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)

  // Fetch seasons on mount (reuse league-manage endpoint which returns all seasons)
  useEffect(() => {
    async function load() {
      try {
        const data = await vaultAdminService.getSeasons()
        setSeasons(data.seasons || [])
      } catch {}
    }
    load()
  }, [])

  // Group seasons by league
  const seasonsByLeague = useMemo(() => {
    const map = new Map()
    for (const s of seasons) {
      const key = s.league_name || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return map
  }, [seasons])

  const toggleSeason = (id) => {
    setSelectedSeasons(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAllActive = () => {
    const activeIds = seasons.filter(s => s.is_active).map(s => s.id)
    setSelectedSeasons(new Set(activeIds))
  }

  const handlePreview = async () => {
    if (!selectedSeasons.size) return
    setLoading(true)
    setEntries(null)
    setResult(null)
    try {
      const data = await vaultAdminService.previewPlayerDefs({
        seasonIds: [...selectedSeasons].join(','),
      })
      setEntries(data.entries || [])
      // Auto-select all non-excluded entries
      const autoSelected = new Set()
      for (const e of data.entries || []) {
        if (e.status !== 'excluded') {
          autoSelected.add(`${e.playerId}-${e.teamId}-${e.seasonId}`)
        }
      }
      setSelected(autoSelected)
    } catch (err) {
      setResult({ success: false, message: err.message || 'Failed to load preview' })
    }
    setLoading(false)
  }

  const toggleEntry = (key) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (!entries) return
    const selectable = entries.filter(e => e.status !== 'excluded')
    if (selected.size === selectable.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectable.map(e => `${e.playerId}-${e.teamId}-${e.seasonId}`)))
    }
  }

  const handleExclude = async (entry) => {
    try {
      await vaultAdminService.excludePlayerDef(entry.playerId, entry.teamId, entry.seasonId)
      setEntries(prev => prev.map(e =>
        e.playerId === entry.playerId && e.teamId === entry.teamId && e.seasonId === entry.seasonId
          ? { ...e, status: 'excluded' }
          : e
      ))
      const key = `${entry.playerId}-${entry.teamId}-${entry.seasonId}`
      setSelected(prev => { const next = new Set(prev); next.delete(key); return next })
    } catch {}
  }

  const handleUnexclude = async (entry) => {
    try {
      await vaultAdminService.unexcludePlayerDef(entry.playerId, entry.teamId, entry.seasonId)
      setEntries(prev => prev.map(e =>
        e.playerId === entry.playerId && e.teamId === entry.teamId && e.seasonId === entry.seasonId
          ? { ...e, status: 'new' }
          : e
      ))
    } catch {}
  }

  const handleGenerate = async () => {
    if (!selected.size) return
    setGenerating(true)
    setResult(null)
    try {
      const toGenerate = [...selected].map(key => {
        const [playerId, teamId, seasonId] = key.split('-').map(Number)
        return { playerId, teamId, seasonId }
      })
      const data = await vaultAdminService.generateSelectedDefs(toGenerate)
      setResult({ success: true, message: `Created ${data.created}, updated ${data.updated} (${data.total} total)` })
      // Refresh preview to update statuses
      await handlePreview()
    } catch (err) {
      setResult({ success: false, message: err.message || 'Generation failed' })
    }
    setGenerating(false)
  }

  const STATUS_BADGES = {
    new: { label: 'New', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    exists: { label: 'Exists', cls: 'bg-white/5 text-[var(--cd-text-mid)] border-white/10' },
    excluded: { label: 'Excluded', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Season Selector */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--cd-text)]">Select Seasons</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllActive}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors cursor-pointer"
            >
              All Active Seasons
            </button>
            <button
              onClick={handlePreview}
              disabled={!selectedSeasons.size || loading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {[...seasonsByLeague.entries()].map(([league, leagueSeasons]) => (
            <div key={league}>
              <div className="text-xs font-bold text-[var(--cd-text-mid)] mb-1.5">{league}</div>
              <div className="flex flex-wrap gap-2">
                {leagueSeasons.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSeason(s.id)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                      selectedSeasons.has(s.id)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[var(--cd-edge)] text-[var(--cd-text-mid)] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {s.name}
                    {s.is_active && <span className="ml-1 text-emerald-400">●</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div className={`text-sm font-bold px-4 py-2 rounded-lg ${result.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {result.message}
        </div>
      )}

      {/* Section 2: Preview Table */}
      {entries && (
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--cd-text)]">
              Preview ({entries.length} combos, {selected.size} selected)
            </h3>
            <button
              onClick={handleGenerate}
              disabled={!selected.size || generating}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {generating ? 'Generating...' : `Generate ${selected.size} Selected`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--cd-text-mid)] border-b border-white/10">
                  <th className="pb-2 pr-2">
                    <input
                      type="checkbox"
                      checked={entries.filter(e => e.status !== 'excluded').length > 0 && selected.size === entries.filter(e => e.status !== 'excluded').length}
                      onChange={toggleAll}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2 pr-4">Team</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Season</th>
                  <th className="pb-2 pr-4">Best God</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const key = `${entry.playerId}-${entry.teamId}-${entry.seasonId}`
                  const isExcluded = entry.status === 'excluded'
                  const badge = STATUS_BADGES[entry.status] || STATUS_BADGES.new

                  return (
                    <tr
                      key={key}
                      className={`border-b border-white/5 ${isExcluded ? 'opacity-40' : ''}`}
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleEntry(key)}
                          disabled={isExcluded}
                          className="accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2 pr-4 font-bold text-[var(--cd-text)]">{entry.playerName}</td>
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-1.5">
                          {entry.teamColor && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: entry.teamColor }}
                            />
                          )}
                          {entry.teamName}
                        </span>
                      </td>
                      <td className="py-2 pr-4 capitalize">{entry.role || '—'}</td>
                      <td className="py-2 pr-4">{entry.seasonName}</td>
                      <td className="py-2 pr-4">{entry.bestGodName || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2">
                        {isExcluded ? (
                          <button
                            onClick={() => handleUnexclude(entry)}
                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            Unexclude
                          </button>
                        ) : (
                          <button
                            onClick={() => handleExclude(entry)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Exclude
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {entries.length === 0 && (
            <p className="text-center text-sm text-[var(--cd-text-mid)] py-8">No player-team combos found for selected seasons.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/vault/CCAdminPlayerDefs.jsx
git commit -m "feat(vault): add CCAdminPlayerDefs component with preview table + exclude controls"
```

### Task 6: Add seasons endpoint + service method

The component needs a list of all seasons with their league name. Add a lightweight GET action to vault-admin.

**Files:**
- Modify: `functions/api/vault-admin.js` (GET switch)
- Modify: `src/services/database.js`

- [ ] **Step 1: Add `seasons` GET action to vault-admin.js**

In the GET switch, add:

```javascript
case 'seasons': return await handleGetSeasons(sql)
```

Handler:

```javascript
async function handleGetSeasons(sql) {
  const seasons = await sql`
    SELECT s.id, s.name, s.slug, s.is_active,
           l.name AS league_name, l.slug AS league_slug,
           d.name AS division_name, d.slug AS division_slug
    FROM seasons s
    JOIN divisions d ON s.division_id = d.id
    JOIN leagues l ON d.league_id = l.id
    ORDER BY l.name, d.tier, s.start_date DESC
  `
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ seasons }) }
}
```

- [ ] **Step 2: Add service method**

In `vaultAdminService` in `src/services/database.js`, add:

```javascript
async getSeasons() {
    return apiCall('vault-admin', { action: 'seasons' })
},
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault-admin.js src/services/database.js
git commit -m "feat(vault): add seasons list endpoint for player defs tab"
```

### Task 7: Wire up the tab in VaultAdmin.jsx

**Files:**
- Modify: `src/pages/admin/VaultAdmin.jsx:1-76`

- [ ] **Step 1: Add import**

After line 13 (CCAdminActions import):

```javascript
import CCAdminPlayerDefs from './vault/CCAdminPlayerDefs'
```

- [ ] **Step 2: Add tab to TABS array**

Insert before the `actions` tab entry (before line 26). Use a user-group/card icon:

```javascript
{ key: 'player-defs', label: 'Player Defs', icon: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z' },
```

- [ ] **Step 3: Add tab content render**

After line 72 (actions render), add:

```jsx
{activeTab === 'player-defs' && <CCAdminPlayerDefs />}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/VaultAdmin.jsx
git commit -m "feat(vault): wire Player Defs tab into VaultAdmin"
```

- [ ] **Step 5: Manual test**

1. Run `npm start`
2. Navigate to Vault Admin
3. Click "Player Defs" tab
4. Click "All Active Seasons" → "Preview"
5. Verify table shows player-team combos with correct statuses
6. Test exclude/unexclude on a row
7. Select a few entries → "Generate Selected"
8. Verify result message and that statuses update to "Exists"

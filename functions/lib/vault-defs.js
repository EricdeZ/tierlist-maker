// Player card definition generation + stats computation
// Generates one cc_player_defs row per player-team-season combination

/**
 * Compute stats for a player on a specific team in a specific season.
 * Uses team_side to correctly attribute games to the right team (handles transfers).
 */
export async function computePlayerStats(sql, playerId, teamId, seasonId) {
  const [stats] = await sql`
    SELECT
      COUNT(*)::int AS games_played,
      COUNT(*) FILTER (
        WHERE g.winner_team_id = CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END
      )::int AS wins,
      COALESCE(SUM(pgs.kills), 0)::int AS total_kills,
      COALESCE(SUM(pgs.deaths), 0)::int AS total_deaths,
      COALESCE(SUM(pgs.assists), 0)::int AS total_assists,
      COALESCE(AVG(NULLIF(pgs.damage, 0)), 0)::int AS avg_damage,
      COALESCE(AVG(NULLIF(pgs.mitigated, 0)), 0)::int AS avg_mitigated
    FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
    JOIN matches m ON g.match_id = m.id
    WHERE lp.player_id = ${playerId}
      AND lp.season_id = ${seasonId}
      AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${teamId}
  `

  // Best god (most played on this team)
  const bestGods = await sql`
    SELECT pgs.god_played,
           COUNT(*)::int AS games,
           COUNT(*) FILTER (
             WHERE g.winner_team_id = CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END
           )::int AS wins
    FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
    JOIN matches m ON g.match_id = m.id
    WHERE lp.player_id = ${playerId}
      AND lp.season_id = ${seasonId}
      AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${teamId}
      AND pgs.god_played IS NOT NULL
    GROUP BY pgs.god_played
    ORDER BY games DESC, pgs.god_played ASC
    LIMIT 1
  `

  const gp = stats?.games_played || 0
  const w = stats?.wins || 0
  const k = stats?.total_kills || 0
  const d = stats?.total_deaths || 0
  const a = stats?.total_assists || 0

  let bestGod = null
  if (bestGods[0]) {
    const bg = bestGods[0]
    const slug = bg.god_played.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGod = {
      name: bg.god_played,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: bg.games,
      winRate: bg.games > 0 ? Math.round((bg.wins / bg.games) * 1000) / 10 : 0,
    }
  }

  return {
    gamesPlayed: gp,
    wins: w,
    winRate: gp > 0 ? Math.round((w / gp) * 1000) / 10 : 0,
    kda: d > 0 ? Math.round(((k + a / 2) / d) * 10) / 10 : k + a / 2,
    avgDamage: stats?.avg_damage || 0,
    avgMitigated: stats?.avg_mitigated || 0,
    totalKills: k,
    totalDeaths: d,
    totalAssists: a,
    bestGod,
  }
}

// Shared helper — discovers all player-team combos for a season
async function discoverPlayerTeamCombos(sql, seasonId) {
  const [season] = await sql`
    SELECT s.id, s.name, s.slug, s.is_active,
           d.id AS division_id, d.name AS division_name, d.slug AS division_slug, d.tier AS division_tier,
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

// Helper — find best god with fallback: same team → any team in season → all-time
async function findBestGod(sql, playerId, teamId, seasonId) {
  // 1) Best god on this specific team in this season
  const [onTeam] = await sql`
    SELECT pgs.god_played FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
    JOIN matches m ON g.match_id = m.id
    WHERE lp.player_id = ${playerId} AND lp.season_id = ${seasonId}
      AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${teamId}
      AND pgs.god_played IS NOT NULL
    GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
  `
  if (onTeam) return onTeam.god_played

  // 2) Best god on any team in this season
  const [inSeason] = await sql`
    SELECT pgs.god_played FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
    WHERE lp.player_id = ${playerId} AND lp.season_id = ${seasonId}
      AND pgs.god_played IS NOT NULL
    GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
  `
  if (inSeason) return inSeason.god_played

  // 3) Best god all-time across any season
  const [allTime] = await sql`
    SELECT pgs.god_played FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
    WHERE lp.player_id = ${playerId}
      AND pgs.god_played IS NOT NULL
    GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
  `
  return allTime?.god_played || null
}

// Helper — upsert a single player def row
async function upsertPlayerDef(sql, e, seasonId, season, cardIndex) {
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

  const bestGodName = await findBestGod(sql, e.playerId, e.teamId, seasonId)

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
    return 'updated'
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
    return 'created'
  }
}

/**
 * Preview player-team combos that would be generated for given seasons.
 * Dry-run — reads only, writes nothing.
 */
export async function previewPlayerDefs(sql, seasonIds) {
  const results = []

  for (const seasonId of seasonIds) {
    const { season, entries } = await discoverPlayerTeamCombos(sql, seasonId)

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

      const bestGodName = await findBestGod(sql, e.playerId, e.teamId, seasonId)

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
        divisionName: season.division_name,
        leagueSlug: season.league_slug,
        divisionSlug: season.division_slug,
        bestGodName,
        status,
      })
    }
  }

  return results
}

/**
 * Generate player defs for only the selected entries.
 * Accepts explicit list of { playerId, teamId, seasonId }.
 */
export async function generateSelectedDefs(sql, selectedEntries) {
  let created = 0
  let updated = 0

  const bySeasonId = new Map()
  for (const e of selectedEntries) {
    if (!bySeasonId.has(e.seasonId)) bySeasonId.set(e.seasonId, [])
    bySeasonId.get(e.seasonId).push(e)
  }

  for (const [seasonId, seasonEntries] of bySeasonId) {
    const { season, entries: allEntries } = await discoverPlayerTeamCombos(sql, seasonId)

    const requestedKeys = new Set(seasonEntries.map(e => `${e.playerId}-${e.teamId}`))
    const filtered = allEntries.filter(e => requestedKeys.has(`${e.playerId}-${e.teamId}`))

    // Build index map from ALL entries so card_index stays stable
    const indexMap = new Map()
    allEntries.forEach((e, i) => indexMap.set(`${e.playerId}-${e.teamId}`, i + 1))

    for (const e of filtered) {
      const cardIndex = indexMap.get(`${e.playerId}-${e.teamId}`)
      const result = await upsertPlayerDef(sql, e, seasonId, season, cardIndex)
      if (result === 'created') created++
      else updated++
    }
  }

  return { created, updated, total: created + updated }
}

/**
 * Generate player card definitions for a season (all combos).
 * @returns {{ created: number, updated: number, total: number }}
 */
export async function generatePlayerDefs(sql, seasonId) {
  const { season, entries } = await discoverPlayerTeamCombos(sql, seasonId)

  let created = 0
  let updated = 0
  for (let i = 0; i < entries.length; i++) {
    const result = await upsertPlayerDef(sql, entries[i], seasonId, season, i + 1)
    if (result === 'created') created++
    else updated++
  }

  return { created, updated, total: entries.length }
}

/**
 * Freeze stats for all player defs in a season.
 * Computes final stats and writes to frozen_stats JSONB.
 */
export async function freezeSeasonStats(sql, seasonId) {
  const defs = await sql`
    SELECT id, player_id, team_id, season_id
    FROM cc_player_defs
    WHERE season_id = ${seasonId} AND frozen_stats IS NULL
  `

  let frozen = 0
  for (const def of defs) {
    const stats = await computePlayerStats(sql, def.player_id, def.team_id, def.season_id)
    await sql`
      UPDATE cc_player_defs
      SET frozen_stats = ${JSON.stringify(stats)}, updated_at = NOW()
      WHERE id = ${def.id}
    `
    frozen++
  }

  return { frozen, total: defs.length }
}

/**
 * Backfill def_id on existing player cards that don't have one.
 * Matches by player_id from card_data and team_name.
 */
export async function backfillCardDefs(sql) {
  const result = await sql`
    UPDATE cc_cards c
    SET def_id = d.id
    FROM cc_player_defs d
    WHERE c.card_type = 'player'
      AND c.def_id IS NULL
      AND (c.card_data->>'playerId')::int = d.player_id
      AND c.card_data->>'teamName' = d.team_name
  `
  return { updated: result.count || 0 }
}

/**
 * Refresh best_god_name for all player defs affected by a match.
 * Called fire-and-forget after match reports.
 */
export async function refreshBestGods(sql, matchId) {
  // Find all player-team-season combos from this match
  const players = await sql`
    SELECT DISTINCT lp.player_id,
           CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS team_id,
           lp.season_id
    FROM player_game_stats pgs
    JOIN league_players lp ON lp.id = pgs.league_player_id
    JOIN games g ON g.id = pgs.game_id
    JOIN matches m ON m.id = g.match_id
    WHERE g.match_id = ${matchId}
  `

  for (const p of players) {
    const bestGodName = await findBestGod(sql, p.player_id, p.team_id, p.season_id)
    const [lp] = await sql`
      SELECT role FROM league_players
      WHERE player_id = ${p.player_id} AND season_id = ${p.season_id} LIMIT 1
    `
    await sql`
      UPDATE cc_player_defs
      SET best_god_name = COALESCE(${bestGodName}, best_god_name),
          role = COALESCE(${lp?.role || null}, role),
          updated_at = NOW()
      WHERE player_id = ${p.player_id} AND team_id = ${p.team_id} AND season_id = ${p.season_id}
    `
  }
}

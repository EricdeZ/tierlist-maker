// Player card definition generation + stats computation
// Generates one cc_player_defs row per player-team-season combination

/**
 * Determine primary and secondary role for a league_player from their game history.
 * Primary = most played role (by game count), ties broken by most recent game.
 * Secondary = second most played role, same tie-break.
 * league_player_id is already scoped to a specific player+team+season.
 */
async function recalcRoleForPlayer(sql, league_player_id) {
  const roles = await sql`
    SELECT LOWER(pgs.role_played) as role, COUNT(*)::int as games, MAX(g.id) as last_game_id
    FROM player_game_stats pgs
    JOIN games g ON g.id = pgs.game_id
    WHERE pgs.league_player_id = ${league_player_id}
    AND pgs.role_played IS NOT NULL
    GROUP BY LOWER(pgs.role_played)
    ORDER BY games DESC, last_game_id DESC
  `
  if (!roles.length) return

  const role = roles[0].role
  const secondaryRole = roles[1]?.role || null
  await sql`
    UPDATE league_players
    SET role = ${role}, secondary_role = ${secondaryRole}, updated_at = NOW()
    WHERE id = ${league_player_id}
  `
  await syncRoleToVault(sql, league_player_id, role)
}

/**
 * Update league_player roles for all players in a match, then cascade to vault.
 * Call after any match submit, game save, or game delete.
 */
export async function updatePlayerRoles(sql, matchId) {
  const players = await sql`
    SELECT DISTINCT pgs.league_player_id FROM player_game_stats pgs
    JOIN league_players lp ON lp.id = pgs.league_player_id
    WHERE pgs.game_id IN (SELECT id FROM games WHERE match_id = ${matchId})
    AND pgs.role_played IS NOT NULL
    AND lp.roster_status != 'sub'
  `
  for (const { league_player_id } of players) {
    await recalcRoleForPlayer(sql, league_player_id)
  }
}

/**
 * Recalculate roles for specific league_player_ids from their remaining game history.
 * Use when the match itself has been deleted and updatePlayerRoles(matchId) can't find the players.
 */
export async function recalcPlayerRolesByIds(sql, leaguePlayerIds) {
  for (const league_player_id of leaguePlayerIds) {
    await recalcRoleForPlayer(sql, league_player_id)
  }
}

/**
 * Sync a role change from league_players to unfrozen vault defs and their minted cards.
 * Call after any league_players.role update to keep vault data consistent.
 */
export async function syncRoleToVault(sql, leaguePlayerId, role) {
  const normalizedRole = role.toLowerCase()
  await sql`
    UPDATE cc_player_defs
    SET role = ${normalizedRole}, updated_at = NOW()
    FROM league_players lp
    WHERE lp.id = ${leaguePlayerId}
    AND cc_player_defs.player_id = lp.player_id
    AND cc_player_defs.season_id = lp.season_id
    AND cc_player_defs.frozen_stats IS NULL
  `
  await sql`
    UPDATE cc_cards
    SET role = ${normalizedRole},
        card_data = jsonb_set(COALESCE(card_data, '{}'::jsonb), '{role}', ${JSON.stringify(normalizedRole.toUpperCase())}::jsonb)
    FROM cc_player_defs d
    WHERE cc_cards.def_id = d.id
    AND cc_cards.card_type = 'player'
    AND d.player_id = (SELECT player_id FROM league_players WHERE id = ${leaguePlayerId})
    AND d.season_id = (SELECT season_id FROM league_players WHERE id = ${leaguePlayerId})
    AND d.frozen_stats IS NULL
  `
}

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

  // Collect missing player-team combos from transactions, then bulk-fetch
  const missingCombos = []
  for (const tx of transactions) {
    if (tx.from_team_id && tx.type !== 'pickup') {
      const key = `${tx.player_id}-${tx.from_team_id}`
      if (!playerTeamMap.has(key)) {
        missingCombos.push({ playerId: tx.player_id, teamId: tx.from_team_id })
        playerTeamMap.set(key, null) // mark as seen to avoid duplicates
      }
    }
  }
  if (missingCombos.length) {
    const missingPlayerIds = [...new Set(missingCombos.map(c => c.playerId))]
    const missingTeamIds = [...new Set(missingCombos.map(c => c.teamId))]
    const [players, teams, roles] = await Promise.all([
      sql`SELECT id, name, slug FROM players WHERE id = ANY(${missingPlayerIds})`,
      sql`SELECT id, name, color FROM teams WHERE id = ANY(${missingTeamIds})`,
      sql`SELECT player_id, role FROM league_players WHERE season_id = ${seasonId} AND player_id = ANY(${missingPlayerIds})`,
    ])
    const pMap = new Map(players.map(p => [p.id, p]))
    const tMap = new Map(teams.map(t => [t.id, t]))
    const rMap = new Map(roles.map(r => [r.player_id, r.role]))
    for (const c of missingCombos) {
      const key = `${c.playerId}-${c.teamId}`
      const p = pMap.get(c.playerId)
      const t = tMap.get(c.teamId)
      if (p && t) {
        playerTeamMap.set(key, {
          playerId: c.playerId,
          teamId: c.teamId,
          playerName: p.name,
          playerSlug: p.slug,
          teamName: t.name,
          teamColor: t.color,
          role: rMap.get(c.playerId) || null,
        })
      } else {
        playerTeamMap.delete(key) // remove placeholder
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

  const normalizedRole = (e.role || 'adc').toLowerCase()

  if (existing) {
    await sql`
      UPDATE cc_player_defs SET
        player_name = ${e.playerName}, player_slug = ${e.playerSlug},
        team_name = ${e.teamName}, team_color = ${e.teamColor}, role = ${normalizedRole},
        league_id = ${season.league_id}, league_slug = ${season.league_slug},
        division_id = ${season.division_id}, division_slug = ${season.division_slug},
        division_tier = ${season.division_tier}, season_slug = ${season.slug},
        card_index = ${cardIndex}, avatar_url = ${avatarUrl}, best_god_name = ${bestGodName},
        updated_at = NOW()
      WHERE id = ${existing.id}
    `
    // Cascade role + card_data.role to minted cards from this def
    await sql`
      UPDATE cc_cards
      SET role = ${normalizedRole},
          card_data = jsonb_set(COALESCE(card_data, '{}'::jsonb), '{role}', ${JSON.stringify(normalizedRole.toUpperCase())}::jsonb)
      WHERE def_id = ${existing.id} AND card_type = 'player'
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
        ${e.playerName}, ${e.playerSlug}, ${e.teamName}, ${e.teamColor}, ${normalizedRole},
        ${season.league_slug}, ${season.division_slug}, ${season.slug}, ${season.division_tier},
        ${cardIndex}, ${avatarUrl}, ${bestGodName}
      )
    `
    return 'created'
  }
}

/**
 * Auto-generate a card def for a single league_player by ID.
 * Resolves all needed context (player, team, season, league metadata) from the DB.
 * No-ops if a def already exists for this player+team+season combo.
 */
export async function ensurePlayerDef(sql, leaguePlayerId) {
  const [lp] = await sql`
    SELECT lp.player_id, lp.team_id, lp.season_id, lp.role,
           p.name AS player_name, p.slug AS player_slug,
           t.name AS team_name, t.color AS team_color,
           s.slug AS season_slug,
           d.id AS division_id, d.slug AS division_slug, d.tier AS division_tier,
           l.id AS league_id, l.slug AS league_slug
    FROM league_players lp
    JOIN players p ON p.id = lp.player_id
    JOIN teams t ON t.id = lp.team_id
    JOIN seasons s ON s.id = lp.season_id
    JOIN divisions d ON d.id = s.division_id
    JOIN leagues l ON l.id = d.league_id
    WHERE lp.id = ${leaguePlayerId}
  `
  if (!lp) return

  const [existing] = await sql`
    SELECT id FROM cc_player_defs
    WHERE player_id = ${lp.player_id} AND team_id = ${lp.team_id} AND season_id = ${lp.season_id}
  `
  if (existing) return

  // Compute card_index: count existing defs in this season + 1
  const [{ count }] = await sql`
    SELECT COUNT(*)::int FROM cc_player_defs WHERE season_id = ${lp.season_id}
  `
  const cardIndex = count + 1

  let avatarUrl = null
  const [userRow] = await sql`
    SELECT u.discord_id, u.discord_avatar,
           COALESCE(up.allow_discord_avatar, true) AS allow_avatar
    FROM users u
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE u.linked_player_id = ${lp.player_id}
  `
  if (userRow?.allow_avatar && userRow.discord_id && userRow.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${userRow.discord_id}/${userRow.discord_avatar}.webp?size=256`
  }

  const bestGodName = await findBestGod(sql, lp.player_id, lp.team_id, lp.season_id)
  const normalizedRole = (lp.role || 'fill').toLowerCase()

  await sql`
    INSERT INTO cc_player_defs (
      player_id, team_id, season_id, league_id, division_id,
      player_name, player_slug, team_name, team_color, role,
      league_slug, division_slug, season_slug, division_tier,
      card_index, avatar_url, best_god_name
    ) VALUES (
      ${lp.player_id}, ${lp.team_id}, ${lp.season_id}, ${lp.league_id}, ${lp.division_id},
      ${lp.player_name}, ${lp.player_slug}, ${lp.team_name}, ${lp.team_color}, ${normalizedRole},
      ${lp.league_slug}, ${lp.division_slug}, ${lp.season_slug}, ${lp.division_tier},
      ${cardIndex}, ${avatarUrl}, ${bestGodName}
    )
  `
}

/**
 * Preview player-team combos that would be generated for given seasons.
 * Dry-run — reads only, writes nothing.
 */
export async function previewPlayerDefs(sql, seasonIds) {
  const results = []

  for (const seasonId of seasonIds) {
    const { season, entries } = await discoverPlayerTeamCombos(sql, seasonId)

    const playerIds = [...new Set(entries.map(e => e.playerId))]
    const [existingDefs, exclusions, bulk] = await Promise.all([
      sql`SELECT player_id, team_id FROM cc_player_defs WHERE season_id = ${seasonId}`,
      sql`SELECT player_id, team_id FROM cc_player_def_exclusions WHERE season_id = ${seasonId}`,
      bulkPreFetch(sql, playerIds, seasonId),
    ])
    const { godTeamMap, godSeasonMap, godAllTimeMap } = bulk
    const defSet = new Set(existingDefs.map(d => `${d.player_id}-${d.team_id}`))
    const exclSet = new Set(exclusions.map(e => `${e.player_id}-${e.team_id}`))

    for (const e of entries) {
      const key = `${e.playerId}-${e.teamId}`
      const bestGodName = godTeamMap.get(key) || godSeasonMap.get(e.playerId) || godAllTimeMap.get(e.playerId) || null

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

// Bulk pre-fetch avatars, best gods, and existing defs for a set of players in a season.
// Reduces ~4-5 queries per player down to ~6 queries total per season.
async function bulkPreFetch(sql, playerIds, seasonId) {
  if (!playerIds.length) return { avatarMap: new Map(), godTeamMap: new Map(), godSeasonMap: new Map(), godAllTimeMap: new Map(), existingMap: new Map() }

  // 1) Bulk avatar lookup
  const avatarRows = await sql`
    SELECT u.linked_player_id AS player_id, u.discord_id, u.discord_avatar,
           COALESCE(up.allow_discord_avatar, true) AS allow_avatar
    FROM users u
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE u.linked_player_id = ANY(${playerIds})
  `
  const avatarMap = new Map()
  for (const r of avatarRows) {
    if (r.allow_avatar && r.discord_id && r.discord_avatar) {
      avatarMap.set(r.player_id, `https://cdn.discordapp.com/avatars/${r.discord_id}/${r.discord_avatar}.webp?size=256`)
    }
  }

  // 2) Bulk best god: specific team in season
  const godOnTeamRows = await sql`
    SELECT player_id, team_id, god_played FROM (
      SELECT sub.player_id, sub.team_id, sub.god_played,
             ROW_NUMBER() OVER (PARTITION BY sub.player_id, sub.team_id ORDER BY sub.cnt DESC, sub.god_played ASC) AS rn
      FROM (
        SELECT lp.player_id,
               CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS team_id,
               pgs.god_played, COUNT(*) AS cnt
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
        JOIN matches m ON g.match_id = m.id
        WHERE lp.season_id = ${seasonId}
          AND lp.player_id = ANY(${playerIds})
          AND pgs.god_played IS NOT NULL
        GROUP BY lp.player_id, CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END, pgs.god_played
      ) sub
    ) ranked WHERE rn = 1
  `
  const godTeamMap = new Map()
  for (const r of godOnTeamRows) godTeamMap.set(`${r.player_id}-${r.team_id}`, r.god_played)

  // 3) Bulk best god: any team in season (fallback)
  const godInSeasonRows = await sql`
    SELECT player_id, god_played FROM (
      SELECT sub.player_id, sub.god_played,
             ROW_NUMBER() OVER (PARTITION BY sub.player_id ORDER BY sub.cnt DESC, sub.god_played ASC) AS rn
      FROM (
        SELECT lp.player_id, pgs.god_played, COUNT(*) AS cnt
        FROM player_game_stats pgs
        JOIN league_players lp ON pgs.league_player_id = lp.id
        JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
        WHERE lp.season_id = ${seasonId}
          AND lp.player_id = ANY(${playerIds})
          AND pgs.god_played IS NOT NULL
        GROUP BY lp.player_id, pgs.god_played
      ) sub
    ) ranked WHERE rn = 1
  `
  const godSeasonMap = new Map()
  for (const r of godInSeasonRows) godSeasonMap.set(r.player_id, r.god_played)

  // 4) Bulk best god: all-time (only for players not found in season)
  const needsAllTime = playerIds.filter(id => !godSeasonMap.has(id))
  const godAllTimeMap = new Map()
  if (needsAllTime.length) {
    const godAllTimeRows = await sql`
      SELECT player_id, god_played FROM (
        SELECT sub.player_id, sub.god_played,
               ROW_NUMBER() OVER (PARTITION BY sub.player_id ORDER BY sub.cnt DESC, sub.god_played ASC) AS rn
        FROM (
          SELECT lp.player_id, pgs.god_played, COUNT(*) AS cnt
          FROM player_game_stats pgs
          JOIN league_players lp ON pgs.league_player_id = lp.id
          JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
          WHERE lp.player_id = ANY(${needsAllTime})
            AND pgs.god_played IS NOT NULL
          GROUP BY lp.player_id, pgs.god_played
        ) sub
      ) ranked WHERE rn = 1
    `
    for (const r of godAllTimeRows) godAllTimeMap.set(r.player_id, r.god_played)
  }

  // 5) Bulk existing defs lookup (full rows for dirty-checking)
  const existingRows = await sql`
    SELECT id, player_id, team_id, player_name, player_slug, team_name, team_color,
           role, league_id, league_slug, division_id, division_slug, division_tier,
           season_slug, card_index, avatar_url, best_god_name
    FROM cc_player_defs WHERE season_id = ${seasonId}
  `
  const existingMap = new Map()
  for (const d of existingRows) existingMap.set(`${d.player_id}-${d.team_id}`, d)

  return { avatarMap, godTeamMap, godSeasonMap, godAllTimeMap, existingMap }
}

/**
 * Generate player defs for only the selected entries.
 * Accepts explicit list of { playerId, teamId, seasonId }.
 * Uses lightweight queries — avoids loading full season roster.
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
    // Lightweight season metadata (no full roster discovery)
    const [season] = await sql`
      SELECT s.id, s.name, s.slug, s.is_active,
             d.id AS division_id, d.name AS division_name, d.slug AS division_slug, d.tier AS division_tier,
             l.id AS league_id, l.slug AS league_slug
      FROM seasons s
      JOIN divisions d ON s.division_id = d.id
      JOIN leagues l ON d.league_id = l.id
      WHERE s.id = ${seasonId}
    `
    if (!season) continue

    const playerIds = [...new Set(seasonEntries.map(e => e.playerId))]
    const teamIds = [...new Set(seasonEntries.map(e => e.teamId))]

    // Bulk-fetch player, team, and role data for selected entries only
    const [players, teams, roles] = await Promise.all([
      sql`SELECT id, name, slug FROM players WHERE id = ANY(${playerIds})`,
      sql`SELECT id, name, color FROM teams WHERE id = ANY(${teamIds})`,
      sql`SELECT player_id, role FROM league_players WHERE season_id = ${seasonId} AND player_id = ANY(${playerIds})`,
    ])
    const playerMap = new Map(players.map(p => [p.id, p]))
    const teamMap = new Map(teams.map(t => [t.id, t]))
    const roleMap = new Map(roles.map(r => [r.player_id, r.role]))

    // Build enriched entries from selected IDs + bulk-fetched data
    const filtered = seasonEntries
      .filter(e => playerMap.has(e.playerId) && teamMap.has(e.teamId))
      .map(e => {
        const player = playerMap.get(e.playerId)
        const team = teamMap.get(e.teamId)
        return {
          playerId: e.playerId,
          teamId: e.teamId,
          playerName: player.name,
          playerSlug: player.slug,
          teamName: team.name,
          teamColor: team.color,
          role: (roleMap.get(e.playerId) || 'adc').toLowerCase(),
        }
      })
    if (!filtered.length) continue

    // Lightweight card_index: fetch just IDs from current roster, sorted
    const rosterCombos = await sql`
      SELECT lp.player_id, lp.team_id
      FROM league_players lp
      JOIN players p ON p.id = lp.player_id
      LEFT JOIN teams t ON t.id = lp.team_id
      WHERE lp.season_id = ${seasonId} AND lp.team_id IS NOT NULL
      ORDER BY t.name ASC, p.name ASC
    `
    const indexMap = new Map()
    rosterCombos.forEach((c, i) => indexMap.set(`${c.player_id}-${c.team_id}`, i + 1))
    // Entries not in current roster get index after the roster
    let extraIndex = rosterCombos.length
    for (const e of filtered) {
      const key = `${e.playerId}-${e.teamId}`
      if (!indexMap.has(key)) indexMap.set(key, ++extraIndex)
    }

    // Bulk pre-fetch avatars, best gods, existing defs
    const { avatarMap, godTeamMap, godSeasonMap, godAllTimeMap, existingMap } =
      await bulkPreFetch(sql, playerIds, seasonId)

    // Upsert in smaller chunks to stay within memory limits
    let skipped = 0
    const CHUNK = 10
    for (let i = 0; i < filtered.length; i += CHUNK) {
      const chunk = filtered.slice(i, i + CHUNK)
      const results = await Promise.all(chunk.map(async (e) => {
        const key = `${e.playerId}-${e.teamId}`
        const cardIndex = indexMap.get(key)
        const avatarUrl = avatarMap.get(e.playerId) || null
        const bestGodName = godTeamMap.get(key) || godSeasonMap.get(e.playerId) || godAllTimeMap.get(e.playerId) || null
        const existing = existingMap.get(key)

        if (existing) {
          // Skip if nothing changed
          if (existing.player_name === e.playerName && existing.player_slug === e.playerSlug &&
              existing.team_name === e.teamName && existing.team_color === e.teamColor &&
              existing.role === e.role && existing.card_index === cardIndex &&
              existing.avatar_url === avatarUrl && existing.best_god_name === bestGodName &&
              existing.league_id === season.league_id && existing.division_tier === season.division_tier) {
            return 'skipped'
          }
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
          if (existing.role !== e.role) {
            await sql`
              UPDATE cc_cards
              SET role = ${e.role},
                  card_data = jsonb_set(COALESCE(card_data, '{}'::jsonb), '{role}', ${JSON.stringify(e.role.toUpperCase())}::jsonb)
              WHERE def_id = ${existing.id} AND card_type = 'player'
            `
          }
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
      }))
      for (const r of results) {
        if (r === 'created') created++
        else if (r === 'updated') updated++
        else skipped++
      }
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
  if (!entries.length) return { created: 0, updated: 0, total: 0 }

  const playerIds = [...new Set(entries.map(e => e.playerId))]
  const { avatarMap, godTeamMap, godSeasonMap, godAllTimeMap, existingMap } =
    await bulkPreFetch(sql, playerIds, seasonId)

  let created = 0
  let updated = 0
  let skipped = 0
  const CHUNK = 50
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK)
    const results = await Promise.all(chunk.map(async (e, j) => {
      const key = `${e.playerId}-${e.teamId}`
      const cardIndex = i + j + 1
      const avatarUrl = avatarMap.get(e.playerId) || null
      const bestGodName = godTeamMap.get(key) || godSeasonMap.get(e.playerId) || godAllTimeMap.get(e.playerId) || null
      const existing = existingMap.get(key)

      if (existing) {
        // Skip if nothing changed
        if (existing.player_name === e.playerName && existing.player_slug === e.playerSlug &&
            existing.team_name === e.teamName && existing.team_color === e.teamColor &&
            existing.role === e.role && existing.card_index === cardIndex &&
            existing.avatar_url === avatarUrl && existing.best_god_name === bestGodName &&
            existing.league_id === season.league_id && existing.division_tier === season.division_tier) {
          return 'skipped'
        }
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
        // Only cascade role to minted cards if role actually changed
        if (existing.role !== e.role) {
          const normalizedRole = (e.role || 'adc').toLowerCase()
          await sql`
            UPDATE cc_cards
            SET role = ${normalizedRole},
                card_data = jsonb_set(COALESCE(card_data, '{}'::jsonb), '{role}', ${JSON.stringify(normalizedRole.toUpperCase())}::jsonb)
            WHERE def_id = ${existing.id} AND card_type = 'player'
          `
        }
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
    }))
    for (const r of results) {
      if (r === 'created') created++
      else if (r === 'updated') updated++
      else skipped++
    }
  }

  return { created, updated, skipped, total: entries.length }
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

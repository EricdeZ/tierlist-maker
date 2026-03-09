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
    ORDER BY games DESC
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

/**
 * Generate player card definitions for a season.
 * Finds all players (including those who transferred between teams)
 * and creates a cc_player_defs row for each player-team combo.
 *
 * @returns {{ created: number, updated: number, total: number }}
 */
export async function generatePlayerDefs(sql, seasonId) {
  // Get season info
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

  // Get all league_players for this season (current team assignments)
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

  // Get roster transactions to find historical team stints
  const transactions = await sql`
    SELECT player_id, from_team_id, to_team_id, from_team_name, to_team_name, type, created_at
    FROM roster_transactions
    WHERE season_id = ${seasonId}
      AND type IN ('transfer', 'pickup', 'release')
    ORDER BY created_at ASC
  `

  // Build a map of all player-team combos
  // Key: "playerId-teamId", Value: { playerId, teamId, ... }
  const playerTeamMap = new Map()

  // Add current team assignments
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

  // Add historical teams from transactions (transfers/releases)
  for (const tx of transactions) {
    // If a player was transferred FROM a team, they had a stint on that team
    if (tx.from_team_id && tx.type !== 'pickup') {
      const key = `${tx.player_id}-${tx.from_team_id}`
      if (!playerTeamMap.has(key)) {
        // Need to look up player info
        const [p] = await sql`
          SELECT p.name, p.slug FROM players p WHERE p.id = ${tx.player_id}
        `
        const [t] = await sql`
          SELECT t.name, t.color FROM teams t WHERE t.id = ${tx.from_team_id}
        `
        // Get role from league_players
        const [lp] = await sql`
          SELECT role FROM league_players
          WHERE player_id = ${tx.player_id} AND season_id = ${seasonId}
          LIMIT 1
        `
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

  // Sort: by team name, then by player name within team
  const entries = [...playerTeamMap.values()]
  entries.sort((a, b) => {
    const teamCmp = (a.teamName || '').localeCompare(b.teamName || '')
    if (teamCmp !== 0) return teamCmp
    return (a.playerName || '').localeCompare(b.playerName || '')
  })

  // Assign card_index (1-based sequential)
  let created = 0
  let updated = 0
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const cardIndex = i + 1

    // Build avatar URL
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

    const [existing] = await sql`
      SELECT id FROM cc_player_defs
      WHERE player_id = ${e.playerId} AND team_id = ${e.teamId} AND season_id = ${seasonId}
    `

    if (existing) {
      await sql`
        UPDATE cc_player_defs SET
          player_name = ${e.playerName},
          player_slug = ${e.playerSlug},
          team_name = ${e.teamName},
          team_color = ${e.teamColor},
          role = ${e.role},
          league_id = ${season.league_id},
          league_slug = ${season.league_slug},
          division_id = ${season.division_id},
          division_slug = ${season.division_slug},
          division_tier = ${season.division_tier},
          season_slug = ${season.slug},
          card_index = ${cardIndex},
          avatar_url = ${avatarUrl},
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
          card_index, avatar_url
        ) VALUES (
          ${e.playerId}, ${e.teamId}, ${seasonId}, ${season.league_id}, ${season.division_id},
          ${e.playerName}, ${e.playerSlug}, ${e.teamName}, ${e.teamColor}, ${e.role},
          ${season.league_slug}, ${season.division_slug}, ${season.slug}, ${season.division_tier},
          ${cardIndex}, ${avatarUrl}
        )
      `
      created++
    }
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

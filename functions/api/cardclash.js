// Card Clash API — action-based endpoint
// GET: load state, definition overrides, shared card | POST: open-pack

import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { jwtVerify } from 'jose'
import { ensureStats, openPack } from '../lib/cardclash.js'
import { ensureEmberBalance } from '../lib/ember.js'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET)

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  // Public endpoints (no auth required)
  if (event.httpMethod === 'GET' && action === 'shared-card') {
    return await handleSharedCard(sql, event.queryStringParameters)
  }

  const user = await requireAuth(event)
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'load': return await handleLoad(sql, user)
        case 'definition-overrides': return await handleDefinitionOverrides(sql)
        case 'collection-catalog': return await handleCollectionCatalog(sql)
        case 'collection-owned': return await handleCollectionOwned(sql, user)
        case 'collection-set': return await handleCollectionSet(sql, event.queryStringParameters)
        case 'card-detail': return await handleCardDetail(sql, event.queryStringParameters)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'open-pack': return await handleOpenPack(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('cardclash error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load state ═══
async function handleLoad(sql, user) {
  await ensureStats(sql, user.id)
  await ensureEmberBalance(sql, user.id)

  const [collection, stats, ember] = await Promise.all([
    sql`SELECT * FROM cc_cards WHERE owner_id = ${user.id} ORDER BY created_at DESC`,
    sql`SELECT * FROM cc_stats WHERE user_id = ${user.id}`,
    sql`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`,
  ])

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collection: collection.map(formatCard),
      stats: formatStats(stats[0]),
      emberBalance: ember[0]?.balance || 0,
    }),
  }
}

// ═══ POST: Open pack ═══
async function handleOpenPack(sql, user, body) {
  const { packType, testMode } = body
  const result = await openPack(sql, user.id, packType, !!testMode)
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })
  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType,
    cards,
  }) }
}

// ═══ GET: Shared player card (public — token-gated preview) ═══
async function handleSharedCard(sql, params) {
  const { token } = params || {}
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) }

  let payload
  try {
    const result = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    payload = result.payload
  } catch {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid or expired share link' }) }
  }

  const { playerSlug, holoEffect, rarity } = payload
  if (!playerSlug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token' }) }

  try {
    const [player] = await sql`
      SELECT p.id, p.name, p.slug,
             u.discord_id, u.discord_avatar,
             COALESCE(up.allow_discord_avatar, true) AS allow_discord_avatar,
             CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
      FROM players p
      LEFT JOIN users u ON u.linked_player_id = p.id
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE p.slug = ${playerSlug}
    `
    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) }

    const [latestSeason] = await sql`
      SELECT lp.role, lp.team_id, t.name AS team_name, t.color AS team_color,
             s.name AS season_name, l.name AS league_name, d.name AS division_name
      FROM league_players lp
      JOIN seasons s ON lp.season_id = s.id
      JOIN divisions d ON s.division_id = d.id
      JOIN leagues l ON s.league_id = l.id
      LEFT JOIN teams t ON lp.team_id = t.id
      WHERE lp.player_id = ${player.id}
      ORDER BY s.is_active DESC, s.start_date DESC
      LIMIT 1
    `

    const games = await sql`
      SELECT pgs.kills, pgs.deaths, pgs.assists, pgs.damage, pgs.mitigated,
             pgs.god_played, pgs.team_side,
             g.winner_team_id,
             CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS player_team_id
      FROM player_game_stats pgs
      JOIN league_players lp ON pgs.league_player_id = lp.id
      JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
      JOIN matches m ON g.match_id = m.id
      WHERE lp.player_id = ${player.id}
      ORDER BY m.date DESC
    `

    let avatarUrl = null
    if (player.allow_discord_avatar && player.discord_id && player.discord_avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
    }

    let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
    const godMap = {}
    for (const g of games) {
      gamesPlayed++
      if (g.winner_team_id === g.player_team_id) wins++
      kills += parseInt(g.kills) || 0
      deaths += parseInt(g.deaths) || 0
      assists += parseInt(g.assists) || 0
      totalDamage += parseInt(g.damage) || 0
      totalMitigated += parseInt(g.mitigated) || 0
      if (g.god_played) {
        if (!godMap[g.god_played]) godMap[g.god_played] = { name: g.god_played, games: 0, wins: 0 }
        godMap[g.god_played].games++
        if (g.winner_team_id === g.player_team_id) godMap[g.god_played].wins++
      }
    }

    const gods = Object.values(godMap).sort((a, b) => b.games - a.games)
    const best = gods[0] || null
    let bestGod = null
    if (best) {
      const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      bestGod = {
        name: best.name,
        imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
        games: best.games,
        winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        holoEffect: holoEffect || 'gold',
        rarity: rarity || 'legendary',
        card: {
          playerName: player.name,
          teamName: latestSeason?.team_name || null,
          teamColor: latestSeason?.team_color || '#6366f1',
          seasonName: latestSeason?.season_name || '',
          leagueName: latestSeason?.league_name || '',
          divisionName: latestSeason?.division_name || '',
          role: (latestSeason?.role || 'ADC').toUpperCase(),
          avatarUrl,
          isConnected: player.is_claimed,
          stats: {
            gamesPlayed,
            wins,
            winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
            kda: deaths > 0 ? (kills + assists / 2) / deaths : kills + assists / 2,
            avgDamage: gamesPlayed > 0 ? totalDamage / gamesPlayed : 0,
            avgMitigated: gamesPlayed > 0 ? totalMitigated / gamesPlayed : 0,
            totalKills: kills,
            totalDeaths: deaths,
            totalAssists: assists,
          },
          bestGod,
        },
      }),
    }
  } catch (error) {
    console.error('shared-card error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) }
  }
}

// ═══ GET: Collection catalog (static — same for all users, cacheable) ═══
async function handleCollectionCatalog(sql) {
  const playerSetSummaries = await sql`
    SELECT
      d.league_slug, d.division_tier, d.division_slug, d.season_slug,
      s.name AS season_name, s.is_active,
      d.league_id,
      div.name AS division_name,
      COUNT(*)::int AS total,
      array_agg(d.id ORDER BY d.card_index) AS def_ids
    FROM cc_player_defs d
    JOIN seasons s ON d.season_id = s.id
    JOIN divisions div ON d.division_id = div.id
    GROUP BY d.league_slug, d.division_tier, d.division_slug, d.season_slug,
             s.name, s.is_active, d.league_id, div.name
    ORDER BY d.league_slug, d.division_tier, d.season_slug
  `

  const playerSets = playerSetSummaries.map(s => ({
    key: `${s.league_slug}-d${s.division_tier}-${s.season_slug}`,
    leagueSlug: s.league_slug,
    leagueId: s.league_id,
    divisionTier: s.division_tier,
    divisionSlug: s.division_slug,
    divisionName: s.division_name,
    seasonSlug: s.season_slug,
    seasonName: s.season_name,
    seasonActive: s.is_active,
    total: s.total,
    defIds: s.def_ids,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ playerSets }) }
}

// ═══ GET: Collection owned (lightweight — only user's ownership data) ═══
async function handleCollectionOwned(sql, user) {
  const [gameCards, playerCards] = await Promise.all([
    sql`
      SELECT card_type, god_id, array_agg(DISTINCT rarity) AS rarities
      FROM cc_cards
      WHERE owner_id = ${user.id} AND card_type != 'player'
      GROUP BY card_type, god_id
    `,
    sql`
      SELECT def_id, array_agg(DISTINCT rarity) AS rarities
      FROM cc_cards
      WHERE owner_id = ${user.id} AND card_type = 'player' AND def_id IS NOT NULL
      GROUP BY def_id
    `,
  ])

  const gameMap = {}
  for (const c of gameCards) gameMap[`${c.card_type}:${c.god_id}`] = c.rarities

  const playerMap = {}
  for (const c of playerCards) playerMap[c.def_id] = c.rarities

  return { statusCode: 200, headers, body: JSON.stringify({ gameCards: gameMap, playerCards: playerMap }) }
}

// ═══ GET: Collection set defs (static — cacheable, no ownership) ═══
async function handleCollectionSet(sql, params) {
  const { setKey } = params || {}
  if (!setKey) return { statusCode: 400, headers, body: JSON.stringify({ error: 'setKey required' }) }

  const defs = await sql`
    SELECT d.id, d.card_index, d.player_name, d.player_slug, d.team_name, d.team_color,
           d.role, d.avatar_url,
           d.league_slug, d.division_tier, d.season_slug,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM cc_player_defs d
    LEFT JOIN players p ON p.slug = d.player_slug
    LEFT JOIN users u ON u.linked_player_id = p.id
    WHERE d.league_slug || '-d' || d.division_tier || '-' || d.season_slug = ${setKey}
    ORDER BY d.card_index
  `

  const cards = defs.map(d => ({
    defId: d.id,
    cardIndex: d.card_index,
    playerName: d.player_name,
    playerSlug: d.player_slug,
    teamName: d.team_name,
    teamColor: d.team_color,
    role: d.role,
    avatarUrl: d.avatar_url,
    isConnected: d.is_claimed,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ cards }) }
}

// ═══ GET: Card detail — player stats for a card definition ═══
async function handleCardDetail(sql, params) {
  const { defId } = params || {}
  if (!defId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'defId required' }) }

  // Use direct FK columns (season_id, division_id) instead of slug reverse-lookup
  const [def] = await sql`
    SELECT d.player_slug, d.season_id,
           s.name AS season_name, l.name AS league_name, div.name AS division_name
    FROM cc_player_defs d
    JOIN seasons s ON d.season_id = s.id
    JOIN divisions div ON d.division_id = div.id
    JOIN leagues l ON s.league_id = l.id
    WHERE d.id = ${defId}
  `
  if (!def) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Definition not found' }) }

  const [player] = await sql`
    SELECT p.id,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM players p
    LEFT JOIN users u ON u.linked_player_id = p.id
    WHERE p.slug = ${def.player_slug}
  `
  if (!player) return { statusCode: 200, headers, body: JSON.stringify({ stats: null }) }

  const games = await sql`
    SELECT pgs.kills, pgs.deaths, pgs.assists, pgs.damage, pgs.mitigated,
           pgs.god_played, pgs.team_side, g.winner_team_id,
           CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS player_team_id
    FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
    JOIN matches m ON g.match_id = m.id
    WHERE lp.player_id = ${player.id} AND lp.season_id = ${def.season_id}
  `

  let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
  const godMap = {}
  for (const g of games) {
    gamesPlayed++
    if (g.winner_team_id === g.player_team_id) wins++
    kills += parseInt(g.kills) || 0
    deaths += parseInt(g.deaths) || 0
    assists += parseInt(g.assists) || 0
    totalDamage += parseInt(g.damage) || 0
    totalMitigated += parseInt(g.mitigated) || 0
    if (g.god_played) {
      if (!godMap[g.god_played]) godMap[g.god_played] = { name: g.god_played, games: 0, wins: 0 }
      godMap[g.god_played].games++
      if (g.winner_team_id === g.player_team_id) godMap[g.god_played].wins++
    }
  }

  const gods = Object.values(godMap).sort((a, b) => b.games - a.games)
  const best = gods[0] || null
  let bestGod = null
  if (best) {
    const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGod = {
      name: best.name,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: best.games,
      winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      stats: {
        gamesPlayed, wins,
        winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
        kda: deaths > 0 ? (kills + assists / 2) / deaths : kills + assists / 2,
        avgDamage: gamesPlayed > 0 ? Math.round(totalDamage / gamesPlayed) : 0,
        avgMitigated: gamesPlayed > 0 ? Math.round(totalMitigated / gamesPlayed) : 0,
        totalKills: kills, totalDeaths: deaths, totalAssists: assists,
      },
      bestGod,
      seasonName: def.season_name,
      isConnected: player.is_claimed,
    }),
  }
}

// ═══ GET: Definition overrides ═══
async function handleDefinitionOverrides(sql) {
  const overrides = await sql`SELECT type, definition_id, metadata FROM cc_definition_overrides`
  const map = {}
  for (const o of overrides) {
    map[`${o.type}:${o.definition_id}`] = o.metadata || {}
  }
  return { statusCode: 200, headers, body: JSON.stringify({ overrides: map }) }
}

// ═══ Formatters ═══
function formatCard(row) {
  return {
    id: row.id,
    godId: row.god_id,
    godName: row.god_name,
    godClass: row.god_class,
    role: row.role,
    rarity: row.rarity,
    power: row.power,
    level: row.level,
    xp: row.xp,
    serialNumber: row.serial_number,
    holoEffect: row.holo_effect,
    imageUrl: row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    acquiredAt: row.created_at,
    cardType: row.card_type || 'god',
    cardData: row.card_data || null,
  }
}

function formatStats(row) {
  if (!row) return { packsOpened: 0, embers: 0 }
  return {
    packsOpened: row.packs_opened,
    embers: row.embers,
  }
}

export const onRequest = adapt(handler)

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
             COALESCE(up.allow_discord_avatar, true) AS allow_discord_avatar
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

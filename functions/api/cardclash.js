// Card Clash API — action-based endpoint
// GET: load state, definition overrides, shared card | POST: open-pack

import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { jwtVerify } from 'jose'
import { ensureStats, openPack, generateGiftPack, grantStarterPacks } from '../lib/cardclash.js'
import { ensureEmberBalance, grantEmber } from '../lib/ember.js'
import { pushChallengeProgress, getVaultStats } from '../lib/challenges.js'
import { tick, collectIncome, slotCard, unslotCard, getCardRates } from '../lib/starting-five.js'

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
        case 'collection-search': return await handleCollectionSearch(sql, event.queryStringParameters)
        case 'card-detail': return await handleCardDetail(sql, event.queryStringParameters)
        case 'gifts': return await handleLoadGifts(sql, user)
        case 'search-users': return await handleSearchUsers(sql, user, event.queryStringParameters)
        case 'starting-five': return await handleStartingFive(sql, user)
        case 'admin-redeem-codes': return await handleAdminRedeemCodes(sql, event)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'open-pack': return await handleOpenPack(sql, user, body)
        case 'open-inventory-pack': return await handleOpenInventoryPack(sql, user, body)
        case 'send-gift': return await handleSendGift(sql, user, body, event)
        case 'open-gift': return await handleOpenGift(sql, user, body)
        case 'buy-gift-pack': return await handleBuyGiftPack(sql, user, body)
        case 'mark-gifts-seen': return await handleMarkGiftsSeen(sql, user)
        case 'dismantle': return await handleDismantle(sql, user, body)
        case 'slot-card': return await handleSlotCard(sql, user, body)
        case 'unslot-card': return await handleUnslotCard(sql, user, body)
        case 'collect-income': return await handleCollectIncome(sql, user)
        case 'redeem-code': return await handleRedeemCode(sql, user, body)
        case 'create-redeem-code': return await handleCreateRedeemCode(sql, event, body)
        case 'toggle-redeem-code': return await handleToggleRedeemCode(sql, event, body)
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
  await grantStarterPacks(sql, user.id)

  // Expire stale trades
  await sql`
    UPDATE cc_trades SET status = 'expired', updated_at = NOW()
    WHERE status IN ('waiting', 'active')
      AND last_polled_at < NOW() - make_interval(mins => 2)
  `

  const [collection, stats, ember, packTypes, salePacks, tradeCount, inventory] = await Promise.all([
    sql`SELECT c.*, d.best_god_name FROM cc_cards c LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player' WHERE c.owner_id = ${user.id} ORDER BY c.created_at DESC`,
    sql`SELECT * FROM cc_stats WHERE user_id = ${user.id}`,
    sql`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`,
    sql`
      SELECT pt.*, l.slug AS league_slug, l.name AS league_name,
             COALESCE(pt.color, l.color) AS resolved_color
      FROM cc_pack_types pt
      LEFT JOIN leagues l ON pt.league_id = l.id
      WHERE pt.enabled = true
      ORDER BY pt.sort_order
    `,
    sql`
      SELECT s.*, pt.name AS base_name, pt.description AS base_description,
             pt.cards_per_pack, pt.category, pt.league_id,
             COALESCE(pt.color, l.color) AS resolved_color
      FROM cc_pack_sales s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      LEFT JOIN leagues l ON pt.league_id = l.id
      WHERE s.active = true
        AND (s.starts_at IS NULL OR s.starts_at <= NOW())
        AND (s.ends_at IS NULL OR s.ends_at > NOW())
      ORDER BY s.sort_order
    `,
    sql`
      SELECT COUNT(*)::int AS count FROM cc_trades
      WHERE (player_b_id = ${user.id} AND status = 'waiting')
         OR ((player_a_id = ${user.id} OR player_b_id = ${user.id}) AND status = 'active')
    `,
    sql`
      SELECT i.id, i.pack_type_id, i.source, i.created_at, pt.name
      FROM cc_pack_inventory i
      JOIN cc_pack_types pt ON i.pack_type_id = pt.id
      WHERE i.user_id = ${user.id}
      ORDER BY i.created_at
    `,
  ])

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collection: collection.map(formatCard),
      stats: formatStats(stats[0]),
      emberBalance: ember[0]?.balance || 0,
      packTypes: packTypes.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        cost: p.cost,
        cards: p.cards_per_pack,
        guarantees: p.guarantees || [],
        category: p.category,
        leagueId: p.league_id,
        leagueSlug: p.league_slug,
        leagueName: p.league_name,
        color: p.resolved_color,
        sortOrder: p.sort_order,
      })),
      salePacks: salePacks.map(s => ({
        id: s.id,
        packTypeId: s.pack_type_id,
        name: s.name || s.base_name,
        description: s.description || s.base_description,
        price: s.price,
        stock: s.stock,
        initialStock: s.initial_stock,
        cards: s.cards_per_pack,
        category: s.category,
        leagueId: s.league_id,
        color: s.resolved_color,
        sortOrder: s.sort_order,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
      })),
      pendingTradeCount: tradeCount[0]?.count || 0,
      inventory: inventory.map(i => ({
        id: i.id,
        packTypeId: i.pack_type_id,
        packName: i.name,
        source: i.source,
        createdAt: i.created_at,
      })),
    }),
  }
}

// ═══ POST: Open pack from inventory ═══
async function handleOpenInventoryPack(sql, user, body) {
  const { inventoryId } = body
  if (!inventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'inventoryId required' }) }

  const [item] = await sql`
    DELETE FROM cc_pack_inventory
    WHERE id = ${inventoryId} AND user_id = ${user.id}
    RETURNING pack_type_id
  `
  if (!item) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack not found in inventory' }) }

  const result = await openPack(sql, user.id, item.pack_type_id, { skipPayment: true })
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: item.pack_type_id,
    cards,
  }) }
}

// ═══ POST: Open pack ═══
async function handleOpenPack(sql, user, body) {
  const { packType, saleId } = body

  // Sale purchase — atomic stock decrement + payment in transaction
  if (saleId) {
    return await handleSalePurchase(sql, user, saleId)
  }

  const result = await openPack(sql, user.id, packType)
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType,
    cards,
  }) }
}

// ═══ POST: Sale purchase — transactional stock + payment ═══
async function handleSalePurchase(sql, user, saleId) {
  const result = await transaction(async (tx) => {
    // Lock the sale row and verify availability
    const [sale] = await tx`
      SELECT s.*, pt.id AS pack_type_id_ref
      FROM cc_pack_sales s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      WHERE s.id = ${saleId} AND s.active = true
        AND (s.starts_at IS NULL OR s.starts_at <= NOW())
        AND (s.ends_at IS NULL OR s.ends_at > NOW())
      FOR UPDATE
    `
    if (!sale) throw new Error('Sale not available')
    if (sale.stock <= 0) throw new Error('Sold out')

    const [updated] = await tx`
      UPDATE cc_pack_sales SET stock = stock - 1
      WHERE id = ${saleId} AND stock > 0
      RETURNING stock
    `
    if (!updated) throw new Error('Sold out')

    // Charge sale price
    if (sale.price > 0) {
      const [bal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`
      if (!bal || bal.balance < sale.price) throw new Error('Not enough Ember')
      await grantEmber(tx, user.id, 'cc_pack', -sale.price, `Card Clash: ${sale.name || 'Sale Pack'}`)
    }

    const packResult = await openPack(tx, user.id, sale.pack_type_id, { skipPayment: true })
    return { ...packResult, stock: updated.stock }
  })

  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: result.packType,
    cards,
    stock: result.stock,
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

  const { playerSlug, holoEffect, rarity, holoType } = payload
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
        holoType: holoType || 'reverse',
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
           d.role, d.best_god_name,
           CASE WHEN COALESCE(up.allow_discord_avatar, true) THEN d.avatar_url ELSE NULL END AS avatar_url,
           d.league_slug, d.division_tier, d.season_slug,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM cc_player_defs d
    LEFT JOIN players p ON p.slug = d.player_slug
    LEFT JOIN users u ON u.linked_player_id = p.id
    LEFT JOIN user_preferences up ON up.user_id = u.id
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
    bestGodName: d.best_god_name,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ cards }) }
}

// ═══ GET: Collection search — find player cards by name/discord ═══
async function handleCollectionSearch(sql, params) {
  const { q } = params || {}
  if (!q || q.trim().length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) }
  }

  const query = q.trim()
  const defs = await sql`
    SELECT d.id, d.card_index, d.player_name, d.player_slug, d.team_name, d.team_color,
           d.role, d.best_god_name,
           CASE WHEN COALESCE(up.allow_discord_avatar, true) THEN d.avatar_url ELSE NULL END AS avatar_url,
           d.league_slug, d.division_tier, d.division_slug, d.season_slug,
           div.name AS division_name,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM cc_player_defs d
    LEFT JOIN players p ON p.slug = d.player_slug
    LEFT JOIN users u ON u.linked_player_id = p.id
    LEFT JOIN user_preferences up ON up.user_id = u.id
    JOIN divisions div ON d.division_id = div.id
    JOIN seasons s ON d.season_id = s.id
    WHERE s.is_active = true
      AND (d.player_name ILIKE ${'%' + query + '%'} OR u.discord_username ILIKE ${'%' + query + '%'})
    ORDER BY d.player_name, d.league_slug, d.division_tier
    LIMIT 30
  `

  const results = defs.map(d => ({
    defId: d.id,
    cardIndex: d.card_index,
    playerName: d.player_name,
    playerSlug: d.player_slug,
    teamName: d.team_name,
    teamColor: d.team_color,
    role: d.role,
    avatarUrl: d.avatar_url,
    isConnected: d.is_claimed,
    bestGodName: d.best_god_name,
    leagueSlug: d.league_slug,
    divisionTier: d.division_tier,
    divisionSlug: d.division_slug,
    divisionName: d.division_name,
    seasonSlug: d.season_slug,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ results }) }
}

// ═══ GET: Card detail — player stats for a card definition ═══
async function handleCardDetail(sql, params) {
  const { defId } = params || {}
  if (!defId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'defId required' }) }

  // Use direct FK columns (season_id, division_id) instead of slug reverse-lookup
  const [def] = await sql`
    SELECT d.player_slug, d.season_id, d.team_id, d.best_god_name,
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
    WHERE lp.player_id = ${player.id} AND lp.season_id = ${def.season_id} AND lp.team_id = ${def.team_id}
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
      bestGodName: def.best_god_name || null,
      seasonName: def.season_name,
      isConnected: player.is_claimed,
    }),
  }
}

// ═══ GET: Load gifts (sent + received) ═══
const MAX_GIFTS = 5
const GIFTABLE_PACKS = ['osl-mixed', 'bsl-mixed']

async function handleLoadGifts(sql, user) {
  const [sent, received, unseenCount, inventory] = await Promise.all([
    sql`
      SELECT g.id, g.recipient_id, g.message, g.created_at, g.pack_type,
             u.discord_username AS recipient_name, u.discord_avatar AS recipient_avatar, u.discord_id AS recipient_discord_id
      FROM cc_gifts g
      JOIN users u ON u.id = g.recipient_id
      WHERE g.sender_id = ${user.id}
      ORDER BY g.created_at DESC
    `,
    sql`
      SELECT g.id, g.sender_id, g.message, g.opened, g.seen, g.created_at, g.opened_at, g.pack_type,
             u.discord_username AS sender_name, u.discord_avatar AS sender_avatar, u.discord_id AS sender_discord_id
      FROM cc_gifts g
      JOIN users u ON u.id = g.sender_id
      WHERE g.recipient_id = ${user.id}
      ORDER BY g.created_at DESC
    `,
    sql`SELECT COUNT(*)::int AS count FROM cc_gifts WHERE recipient_id = ${user.id} AND seen = false`,
    sql`SELECT pack_type, quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND quantity > 0`,
  ])

  const freeGiftsSent = sent.filter(g => g.pack_type === 'gift')

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      sent: sent.map(g => ({
        id: g.id, recipientId: g.recipient_id, recipientName: g.recipient_name,
        recipientAvatar: g.recipient_discord_id && g.recipient_avatar
          ? `https://cdn.discordapp.com/avatars/${g.recipient_discord_id}/${g.recipient_avatar}.webp?size=64` : null,
        message: g.message, createdAt: g.created_at, packType: g.pack_type,
      })),
      received: received.map(g => ({
        id: g.id, senderId: g.sender_id, senderName: g.sender_name,
        senderAvatar: g.sender_discord_id && g.sender_avatar
          ? `https://cdn.discordapp.com/avatars/${g.sender_discord_id}/${g.sender_avatar}.webp?size=64` : null,
        message: g.message, opened: g.opened, seen: g.seen,
        createdAt: g.created_at, openedAt: g.opened_at, packType: g.pack_type,
      })),
      giftsRemaining: MAX_GIFTS - freeGiftsSent.length,
      giftInventory: inventory.map(i => ({ packType: i.pack_type, quantity: i.quantity })),
      unseenCount: unseenCount[0]?.count || 0,
    }),
  }
}

// ═══ POST: Send a gift pack ═══
async function handleSendGift(sql, user, body, event) {
  const { recipientId, message, packType = 'gift' } = body
  if (!recipientId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Recipient required' }) }
  if (recipientId === user.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot gift yourself' }) }

  // Check recipient exists
  const [recipient] = await sql`SELECT id FROM users WHERE id = ${recipientId}`
  if (!recipient) return { statusCode: 400, headers, body: JSON.stringify({ error: 'User not found' }) }

  if (packType === 'gift') {
    // Free gift packs: limited to 5 total, one per recipient
    const [sentCount] = await sql`SELECT COUNT(*)::int AS count FROM cc_gifts WHERE sender_id = ${user.id} AND pack_type = 'gift'`
    if (sentCount.count >= MAX_GIFTS) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No free gifts remaining' }) }
    }
    const [existing] = await sql`SELECT id FROM cc_gifts WHERE sender_id = ${user.id} AND recipient_id = ${recipientId} AND pack_type = 'gift'`
    if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already sent a free gift to this user' }) }
  } else {
    // Purchased packs: decrement from inventory
    if (!GIFTABLE_PACKS.includes(packType)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid gift pack type' }) }
    }
    const [inv] = await sql`SELECT quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND pack_type = ${packType}`
    if (!inv || inv.quantity <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No packs of this type in your gift inventory' }) }
    }
    await sql`UPDATE cc_gift_inventory SET quantity = quantity - 1 WHERE user_id = ${user.id} AND pack_type = ${packType}`
  }

  const trimmedMsg = message ? message.trim().slice(0, 200) : null

  await sql`
    INSERT INTO cc_gifts (sender_id, recipient_id, message, pack_type)
    VALUES (${user.id}, ${recipientId}, ${trimmedMsg}, ${packType})
  `

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (gift send) failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Buy a pack for gifting ═══
async function handleBuyGiftPack(sql, user, body) {
  const { packType } = body || {}
  if (!packType || !GIFTABLE_PACKS.includes(packType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pack type' }) }
  }

  const [pack] = await sql`SELECT id, cost, name FROM cc_pack_types WHERE id = ${packType} AND enabled = true`
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack type not found' }) }

  await ensureEmberBalance(sql, user.id)
  const [bal] = await sql`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`
  if (!bal || bal.balance < pack.cost) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Need ${pack.cost} Cores` }) }
  }

  await grantEmber(sql, user.id, 'cc_gift_pack', -pack.cost, `Card Clash: ${pack.name} (gift)`)

  await sql`
    INSERT INTO cc_gift_inventory (user_id, pack_type, quantity)
    VALUES (${user.id}, ${packType}, 1)
    ON CONFLICT (user_id, pack_type) DO UPDATE SET quantity = cc_gift_inventory.quantity + 1
  `

  const inventory = await sql`SELECT pack_type, quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND quantity > 0`

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      giftInventory: inventory.map(i => ({ packType: i.pack_type, quantity: i.quantity })),
    }),
  }
}

// ═══ POST: Open a received gift ═══
async function handleOpenGift(sql, user, body) {
  const { giftId } = body
  if (!giftId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift ID required' }) }

  const [gift] = await sql`
    SELECT * FROM cc_gifts WHERE id = ${giftId} AND recipient_id = ${user.id} AND opened = false
  `
  if (!gift) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift not found or already opened' }) }

  let packName, newCards

  if (gift.pack_type === 'gift') {
    // Free gift pack — use dedicated generator
    const cards = await generateGiftPack(sql)
    newCards = []
    for (const card of cards) {
      const [inserted] = await sql`
        INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id)
        VALUES (${user.id}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url}, ${'gift'}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}, ${card.def_id || null})
        RETURNING *
      `
      if (card._revealOrder != null) inserted._revealOrder = card._revealOrder
      newCards.push(inserted)
    }
    await ensureStats(sql, user.id)
    await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${user.id}`
    packName = 'Gift Pack'
  } else {
    // Purchased pack gift — use standard pack opener (skip payment, already paid)
    const result = await openPack(sql, user.id, gift.pack_type, { skipPayment: true })
    packName = result.packName
    newCards = result.cards
  }

  // Mark gift as opened
  await sql`UPDATE cc_gifts SET opened = true, seen = true, opened_at = NOW() WHERE id = ${giftId}`

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (gift open) failed:', err))

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      packName,
      packType: gift.pack_type,
      cards: newCards.map(c => {
        const formatted = formatCard(c)
        if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
        return formatted
      }),
    }),
  }
}

// ═══ POST: Mark all gifts as seen ═══
async function handleMarkGiftsSeen(sql, user) {
  await sql`UPDATE cc_gifts SET seen = true WHERE recipient_id = ${user.id} AND seen = false`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ GET: Search users for gifting ═══
async function handleSearchUsers(sql, user, params) {
  const { q } = params || {}
  if (!q || q.trim().length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ users: [] }) }
  }

  const query = q.trim()
  const results = await sql`
    SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id, p.name AS player_name
    FROM users u
    LEFT JOIN players p ON p.id = u.linked_player_id
    WHERE u.id != ${user.id}
      AND (u.discord_username ILIKE ${'%' + query + '%'} OR p.name ILIKE ${'%' + query + '%'})
    ORDER BY u.discord_username ASC
    LIMIT 10
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      users: results.map(u => ({
        id: u.id,
        discordUsername: u.discord_username,
        playerName: u.player_name,
        avatar: u.discord_id && u.discord_avatar
          ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.webp?size=64` : null,
      })),
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

// ═══ POST: Dismantle cards for Ember ═══
const DISMANTLE_VALUES = {
  common: 0.2, uncommon: 1, rare: 3, epic: 8, legendary: 25, mythic: 75,
}

async function handleDismantle(sql, user, body) {
  const { cardIds } = body
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No cards selected' }) }
  }
  if (cardIds.length > 200) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Too many cards (max 200)' }) }
  }

  // Fetch cards owned by user, excluding those locked on market, in active trades, or in Starting 5
  const cards = await sql`
    SELECT c.id, c.rarity FROM cc_cards c
    WHERE c.id = ANY(${cardIds}) AND c.owner_id = ${user.id}
      AND NOT EXISTS (
        SELECT 1 FROM cc_market_listings ml
        WHERE ml.card_id = c.id AND ml.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_trade_cards tc
        JOIN cc_trades t ON tc.trade_id = t.id
        WHERE tc.card_id = c.id AND t.status IN ('waiting', 'active')
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_lineups l
        WHERE l.card_id = c.id AND l.user_id = ${user.id}
      )
  `
  if (cards.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid cards found — some may be in your Starting 5, listed on the market, or in a trade' }) }
  }

  // Calculate total (fractional sum, floor at the end)
  let rawTotal = 0
  for (const card of cards) {
    rawTotal += DISMANTLE_VALUES[card.rarity] || 0
  }
  const emberGained = Math.floor(rawTotal)

  if (emberGained < 1) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selected cards are worth less than 1 Ember' }) }
  }

  // Count legendaries before deleting
  const legendaryCount = cards.filter(c => c.rarity === 'legendary' || c.rarity === 'mythic').length

  // Delete the cards (clean up completed trade references first to avoid FK violation)
  const validIds = cards.map(c => c.id)
  await sql`
    DELETE FROM cc_trade_cards tc
    USING cc_trades t
    WHERE tc.trade_id = t.id AND tc.card_id = ANY(${validIds})
      AND t.status NOT IN ('waiting', 'active')
  `
  await sql`DELETE FROM cc_cards WHERE id = ANY(${validIds}) AND owner_id = ${user.id}`

  // Grant ember
  const { balance } = await grantEmber(sql, user.id, 'dismantle', emberGained, `Dismantled ${validIds.length} card${validIds.length > 1 ? 's' : ''}`)

  // Update dismantle stats in cc_stats
  await ensureStats(sql, user.id)
  await sql`
    UPDATE cc_stats SET
      cards_dismantled = cards_dismantled + ${validIds.length},
      legendary_cards_dismantled = legendary_cards_dismantled + ${legendaryCount}
    WHERE user_id = ${user.id}
  `

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (dismantle) failed:', err))

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ dismantled: validIds.length, emberGained, balance }),
  }
}

// ═══ Starting 5 ═══

function formatS5Response(state, extra = {}) {
  const cardsWithRates = state.cards.map(c => ({
    ...formatCard(c),
    slotRole: c.slot_role,
    passionPerHour: getCardRates(c.holo_type, c.rarity).passionPerHour,
    coresPerHour: getCardRates(c.holo_type, c.rarity).coresPerHour,
  }))

  const totalPassionPerHour = cardsWithRates.reduce((s, c) => s + c.passionPerHour, 0)
  const totalCoresPerHour = cardsWithRates.reduce((s, c) => s + c.coresPerHour, 0)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ...extra,
      cards: cardsWithRates,
      passionPending: state.passionPending,
      coresPending: state.coresPending,
      lastTick: state.lastTick,
      totalPassionPerHour,
      totalCoresPerHour,
      passionCap: state.passionCap || totalPassionPerHour * 48,
      coresCap: state.coresCap || totalCoresPerHour * 48,
    }),
  }
}

async function handleStartingFive(sql, user) {
  const state = await tick(sql, user.id)
  return formatS5Response(state)
}

async function handleSlotCard(sql, user, body) {
  const { cardId, role } = body
  if (!cardId || !role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId and role required' }) }
  }
  const state = await slotCard(sql, user.id, cardId, role)

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (slot) failed:', err))

  return formatS5Response(state)
}

async function handleUnslotCard(sql, user, body) {
  const { role } = body
  if (!role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role required' }) }
  }
  const state = await unslotCard(sql, user.id, role)

  // Push vault challenge progress (fire-and-forget) — updates starting_five counts
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (unslot) failed:', err))

  return formatS5Response(state)
}

async function handleCollectIncome(sql, user) {
  const result = await collectIncome(sql, user.id)

  // Track income collections + push challenge progress (fire-and-forget)
  if (result.passionGranted > 0 || result.coresGranted > 0) {
    ensureStats(sql, user.id)
      .then(() => sql`UPDATE cc_stats SET income_collections = income_collections + 1 WHERE user_id = ${user.id}`)
      .then(() => getVaultStats(sql, user.id))
      .then(stats => pushChallengeProgress(sql, user.id, stats))
      .catch(err => console.error('Vault challenge push (income) failed:', err))
  }

  return formatS5Response(result, {
    passionGranted: result.passionGranted,
    coresGranted: result.coresGranted,
  })
}

// ═══ Redeem Codes ═══

async function handleRedeemCode(sql, user, body) {
  const { code } = body
  if (!code || typeof code !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code required' }) }
  }

  const trimmed = code.trim().toUpperCase()
  const [row] = await sql`SELECT * FROM cc_redeem_codes WHERE UPPER(code) = ${trimmed} AND active = true`
  if (!row) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or expired code' }) }

  // Check expiration
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has expired' }) }
  }

  // Check max uses
  if (row.max_uses != null && row.times_redeemed >= row.max_uses) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has reached its redemption limit' }) }
  }

  // For per_person: check if user already redeemed
  if (row.mode === 'per_person') {
    const [existing] = await sql`SELECT id FROM cc_redeem_history WHERE code_id = ${row.id} AND user_id = ${user.id}`
    if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You have already redeemed this code' }) }
  }

  // For single: check not already used (belt-and-suspenders with active flag)
  if (row.mode === 'single' && row.times_redeemed > 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has already been used' }) }
  }

  // Generate the pack
  const result = await openPack(sql, user.id, row.pack_type_id, { skipPayment: true })

  // Record redemption
  await sql`INSERT INTO cc_redeem_history (code_id, user_id) VALUES (${row.id}, ${user.id})`
  await sql`UPDATE cc_redeem_codes SET times_redeemed = times_redeemed + 1 WHERE id = ${row.id}`

  // For single-use, deactivate
  if (row.mode === 'single') {
    await sql`UPDATE cc_redeem_codes SET active = false WHERE id = ${row.id}`
  }

  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push (redeem) failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: row.pack_type_id,
    cards,
  }) }
}

async function handleAdminRedeemCodes(sql, event) {
  await requirePermission(event, 'permission_manage')

  const codes = await sql`
    SELECT c.*, u.discord_username AS creator_name,
           pt.name AS pack_name
    FROM cc_redeem_codes c
    LEFT JOIN users u ON u.id = c.created_by
    LEFT JOIN cc_pack_types pt ON pt.id = c.pack_type_id
    ORDER BY c.created_at DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        packTypeId: c.pack_type_id,
        packName: c.pack_name,
        mode: c.mode,
        maxUses: c.max_uses,
        expiresAt: c.expires_at,
        timesRedeemed: c.times_redeemed,
        active: c.active,
        creatorName: c.creator_name,
        createdAt: c.created_at,
      })),
    }),
  }
}

async function handleCreateRedeemCode(sql, event, body) {
  await requirePermission(event, 'permission_manage')
  const user = await requireAuth(event)

  const { code, packTypeId, mode, maxUses, expiresAt } = body
  if (!code || !packTypeId || !mode) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'code, packTypeId, and mode are required' }) }
  }
  if (!['single', 'per_person'].includes(mode)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'mode must be single or per_person' }) }
  }

  // Verify pack type exists
  const [pack] = await sql`SELECT id FROM cc_pack_types WHERE id = ${packTypeId}`
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack type not found' }) }

  // Check for duplicate code
  const trimmed = code.trim().toUpperCase()
  const [existing] = await sql`SELECT id FROM cc_redeem_codes WHERE UPPER(code) = ${trimmed}`
  if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'A code with this name already exists' }) }

  await sql`
    INSERT INTO cc_redeem_codes (code, pack_type_id, mode, max_uses, expires_at, created_by)
    VALUES (${code.trim()}, ${packTypeId}, ${mode}, ${maxUses || null}, ${expiresAt || null}, ${user.id})
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleToggleRedeemCode(sql, event, body) {
  await requirePermission(event, 'permission_manage')

  const { codeId, active } = body
  if (!codeId || typeof active !== 'boolean') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'codeId and active required' }) }
  }

  await sql`UPDATE cc_redeem_codes SET active = ${active} WHERE id = ${codeId}`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
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
    holoType: row.holo_type,
    imageUrl: row.card_type === 'player' && row.image_url && !row.image_url.includes('cdn.discordapp.com')
      ? '' : row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    acquiredAt: row.created_at,
    cardType: row.card_type || 'god',
    cardData: row.card_data || null,
    defId: row.def_id || null,
    isFirstEdition: row.is_first_edition || false,
    bestGodName: row.best_god_name || null,
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

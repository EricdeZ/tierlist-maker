// Card Clash Admin API — manage cards, view stats, edit metadata
// Permission: cardclash_manage (global only)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { SignJWT } from 'jose'
import { generatePlayerDefs, freezeSeasonStats, backfillCardDefs, previewPlayerDefs, generateSelectedDefs } from '../lib/vault-defs.js'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET)

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: adminHeaders, body: '' }
  }

  const user = await requirePermission(event, 'cardclash_manage')
  if (!user) {
    return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'stats':       return await handleStats(sql)
        case 'cards':       return await handleListCards(sql, event.queryStringParameters)
        case 'card':        return await handleGetCard(sql, event.queryStringParameters)
        case 'users':       return await handleListUsers(sql, event.queryStringParameters)
        case 'holo-types':  return await handleHoloTypes()
        case 'definition-overrides': return await handleGetDefinitionOverrides(sql, event.queryStringParameters)
        case 'seasons':             return await handleGetSeasons(sql)
        case 'preview-player-defs': return await handlePreviewPlayerDefs(sql, event.queryStringParameters)
        case 'signature-requests':  return await handleListSignatureRequests(sql, event.queryStringParameters)
        case 'search-player-defs':  return await handleSearchPlayerDefs(sql, event.queryStringParameters)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'update-card':        return await handleUpdateCard(sql, body)
        case 'bulk-update-cards':  return await handleBulkUpdateCards(sql, body)
        case 'grant-card':         return await handleGrantCard(sql, body)
        case 'delete-card':        return await handleDeleteCard(sql, body)
        case 'update-user-stats':  return await handleUpdateUserStats(sql, body)
        case 'save-definition-override': return await handleSaveDefinitionOverride(sql, body)
        case 'generate-share-link':     return await handleGenerateShareLink(body)
        case 'generate-player-defs':   return await handleGeneratePlayerDefs(sql, body)
        case 'freeze-season-stats':    return await handleFreezeSeasonStats(sql, body)
        case 'backfill-card-defs':     return await handleBackfillCardDefs(sql)
        case 'refresh-best-gods':     return await handleRefreshBestGods(sql)
        case 'generate-selected-defs': return await handleGenerateSelectedDefs(sql, body)
        case 'exclude-player-def':     return await handleExcludePlayerDef(sql, body, user)
        case 'unexclude-player-def':   return await handleUnexcludePlayerDef(sql, body)
        case 'ban-user':           return await handleBanUser(sql, body, user)
        case 'unban-user':         return await handleUnbanUser(sql, body)
        case 'admin-request-signature': return await handleAdminRequestSignature(sql, body, user)
        case 'search-unique-cards':     return await handleSearchUniqueCards(sql, body)
        case 'delete-signature-request': return await handleDeleteSignatureRequest(sql, body)
        case 'create-test-signature-card': return await handleCreateTestSignatureCard(sql, body, user)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('vault-admin error:', error)
    return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Global stats overview ═══
async function handleStats(sql) {
  const [cardStats] = await sql`
    SELECT
      COUNT(*)::int AS total_cards,
      COUNT(DISTINCT owner_id)::int AS total_players,
      jsonb_object_agg(rarity, cnt) AS rarity_counts
    FROM (
      SELECT rarity, COUNT(*)::int AS cnt FROM cc_cards GROUP BY rarity
    ) sub
  `

  const [packStats] = await sql`
    SELECT SUM(packs_opened)::int AS total_packs FROM cc_stats
  `

  const holoDistribution = await sql`
    SELECT holo_effect, COUNT(*)::int AS count
    FROM cc_cards
    GROUP BY holo_effect
    ORDER BY count DESC
  `

  const topPlayers = await sql`
    SELECT s.user_id, u.discord_username, s.elo, s.wins, s.losses, s.packs_opened, s.embers,
           (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count
    FROM cc_stats s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.elo DESC
    LIMIT 20
  `

  const recentCards = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c
    JOIN users u ON u.id = c.owner_id
    ORDER BY c.created_at DESC
    LIMIT 20
  `

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      totalCards: cardStats?.total_cards || 0,
      totalPlayers: cardStats?.total_players || 0,
      totalPacks: packStats?.total_packs || 0,
      rarityCounts: cardStats?.rarity_counts || {},
      holoDistribution,
      topPlayers,
      recentCards: recentCards.map(formatAdminCard),
    }),
  }
}

// ═══ GET: List/search cards ═══
async function handleListCards(sql, params) {
  const { search, rarity, holo, owner, god_id, sort = 'created_at', order = 'desc', limit = '50', offset = '0' } = params

  const lim = Math.min(parseInt(limit) || 50, 200)
  const off = parseInt(offset) || 0

  let cards
  if (search) {
    cards = await sql`
      SELECT c.*, u.discord_username AS owner_name
      FROM cc_cards c
      JOIN users u ON u.id = c.owner_id
      WHERE (c.god_name ILIKE ${'%' + search + '%'} OR u.discord_username ILIKE ${'%' + search + '%'})
        AND (${rarity || null}::text IS NULL OR c.rarity = ${rarity})
        AND (${holo || null}::text IS NULL OR c.holo_effect = ${holo})
        AND (${owner || null}::text IS NULL OR c.owner_id = ${parseInt(owner) || 0})
        AND (${god_id || null}::text IS NULL OR c.god_id = ${god_id})
      ORDER BY c.created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `
  } else {
    cards = await sql`
      SELECT c.*, u.discord_username AS owner_name
      FROM cc_cards c
      JOIN users u ON u.id = c.owner_id
      WHERE (${rarity || null}::text IS NULL OR c.rarity = ${rarity})
        AND (${holo || null}::text IS NULL OR c.holo_effect = ${holo})
        AND (${owner || null}::text IS NULL OR c.owner_id = ${parseInt(owner) || 0})
        AND (${god_id || null}::text IS NULL OR c.god_id = ${god_id})
      ORDER BY c.created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `
  }

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM cc_cards`

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({ cards: cards.map(formatAdminCard), total: count }),
  }
}

// ═══ GET: Single card detail ═══
async function handleGetCard(sql, params) {
  const { id } = params
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [card] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c
    JOIN users u ON u.id = c.owner_id
    WHERE c.id = ${parseInt(id)}
  `

  if (!card) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Card not found' }) }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ card: formatAdminCard(card) }) }
}

// ═══ GET: Users with CC stats ═══
async function handleListUsers(sql, params) {
  const { search, limit = '50', offset = '0' } = params
  const lim = Math.min(parseInt(limit) || 50, 200)
  const off = parseInt(offset) || 0

  let users
  if (search) {
    users = await sql`
      SELECT s.*, u.discord_username,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count,
             vb.banned_at
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN cc_vault_bans vb ON vb.user_id = s.user_id
      WHERE u.discord_username ILIKE ${'%' + search + '%'}
      ORDER BY s.elo DESC
      LIMIT ${lim} OFFSET ${off}
    `
  } else {
    users = await sql`
      SELECT s.*, u.discord_username,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count,
             vb.banned_at
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN cc_vault_bans vb ON vb.user_id = s.user_id
      ORDER BY s.elo DESC
      LIMIT ${lim} OFFSET ${off}
    `
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ users }) }
}

// ═══ GET: All available holo types ═══
async function handleHoloTypes() {
  const HOLO_TYPES = {
    common:       { rarity: 'common',    label: 'Common',       description: 'Minimal glow effect' },
    holo:         { rarity: 'uncommon',  label: 'Holo',         description: 'Classic holographic shimmer' },
    amazing:      { rarity: 'uncommon',  label: 'Amazing',      description: 'Enhanced holographic pattern' },
    reverse:      { rarity: 'uncommon',  label: 'Reverse',      description: 'Reverse holographic finish' },
    galaxy:       { rarity: 'rare',      label: 'Galaxy',       description: 'Galactic swirl pattern' },
    vstar:        { rarity: 'rare',      label: 'V-Star',       description: 'Star burst effect' },
    shiny:        { rarity: 'rare',      label: 'Shiny',        description: 'Shiny metallic finish' },
    ultra:        { rarity: 'rare',      label: 'Ultra',        description: 'Ultra-rare shine effect' },
    radiant:      { rarity: 'epic',      label: 'Radiant',      description: 'Radiant light burst' },
    sparkle:      { rarity: 'epic',      label: 'Sparkle',      description: 'Sparkling particle effect' },
    'rainbow-alt':{ rarity: 'epic',      label: 'Rainbow Alt',  description: 'Alternate rainbow pattern' },
    cosmos:       { rarity: 'epic',      label: 'Cosmos',       description: 'Cosmic nebula effect' },
    rainbow:      { rarity: 'legendary', label: 'Rainbow',      description: 'Full rainbow spectrum' },
    secret:       { rarity: 'legendary', label: 'Secret',       description: 'Secret rare finish' },
    gold:         { rarity: 'legendary', label: 'Gold',         description: 'Premium gold finish' },
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ holoTypes: HOLO_TYPES }) }
}

// ═══ POST: Update single card ═══
async function handleUpdateCard(sql, body) {
  const { id, updates } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const allowed = ['rarity', 'power', 'level', 'xp', 'holo_effect', 'image_url', 'metadata']

  for (const key of Object.keys(updates)) {
    if (!allowed.includes(key)) {
      return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Cannot update field: ${key}` }) }
    }
  }

  // Build dynamic update
  if (updates.rarity !== undefined) {
    await sql`UPDATE cc_cards SET rarity = ${updates.rarity} WHERE id = ${id}`
  }
  if (updates.power !== undefined) {
    await sql`UPDATE cc_cards SET power = ${parseInt(updates.power)} WHERE id = ${id}`
  }
  if (updates.level !== undefined) {
    await sql`UPDATE cc_cards SET level = ${parseInt(updates.level)} WHERE id = ${id}`
  }
  if (updates.xp !== undefined) {
    await sql`UPDATE cc_cards SET xp = ${parseInt(updates.xp)} WHERE id = ${id}`
  }
  if (updates.holo_effect !== undefined) {
    await sql`UPDATE cc_cards SET holo_effect = ${updates.holo_effect} WHERE id = ${id}`
  }
  if (updates.image_url !== undefined) {
    await sql`UPDATE cc_cards SET image_url = ${updates.image_url} WHERE id = ${id}`
  }
  if (updates.metadata !== undefined) {
    await sql`UPDATE cc_cards SET metadata = ${JSON.stringify(updates.metadata)} WHERE id = ${id}`
  }

  const [card] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c
    JOIN users u ON u.id = c.owner_id
    WHERE c.id = ${id}
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ card: formatAdminCard(card) }) }
}

// ═══ POST: Bulk update cards ═══
async function handleBulkUpdateCards(sql, body) {
  const { cardIds, updates } = body
  if (!cardIds?.length) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'cardIds required' }) }

  let updated = 0
  for (const id of cardIds) {
    if (updates.holo_effect !== undefined) {
      await sql`UPDATE cc_cards SET holo_effect = ${updates.holo_effect} WHERE id = ${id}`
      updated++
    }
    if (updates.rarity !== undefined) {
      await sql`UPDATE cc_cards SET rarity = ${updates.rarity} WHERE id = ${id}`
    }
    if (updates.metadata !== undefined) {
      await sql`UPDATE cc_cards SET metadata = ${JSON.stringify(updates.metadata)} WHERE id = ${id}`
    }
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ updated }) }
}

// ═══ POST: Grant card to user ═══
async function handleGrantCard(sql, body) {
  const { userId, godId, godName, godClass, role, rarity, power, holoEffect, holoType, imageUrl, cardType, cardData, defId } = body
  if (!userId || !godId || !godName) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId, godId, godName required' }) }
  }

  const serialNumber = Math.floor(Math.random() * 9999) + 1
  const resolvedHoloType = holoType || (rarity && rarity !== 'common' ? ['holo','reverse','full'][Math.floor(Math.random()*3)] : null)

  const [card] = await sql`
    INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id)
    VALUES (${userId}, ${userId}, ${godId}, ${godName}, ${godClass || 'Warrior'}, ${role || 'solo'}, ${rarity || 'common'}, ${power || 50}, 1, 0, ${serialNumber}, ${holoEffect || 'common'}, ${resolvedHoloType}, ${imageUrl || ''}, 'admin_grant', ${cardType || 'god'}, ${cardData ? JSON.stringify(cardData) : null}, ${defId || null})
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ card: formatAdminCard(card) }) }
}

// ═══ POST: Delete card ═══
async function handleDeleteCard(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  // Clear from lineups and trade references first
  await sql`UPDATE cc_lineups SET card_id = NULL WHERE card_id = ${id}`
  await sql`DELETE FROM cc_trade_cards WHERE card_id = ${id}`
  await sql`DELETE FROM cc_cards WHERE id = ${id}`

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ deleted: true }) }
}

// ═══ POST: Update user stats ═══
async function handleUpdateUserStats(sql, body) {
  const { userId, updates } = body
  if (!userId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }

  if (updates.elo !== undefined) await sql`UPDATE cc_stats SET elo = ${parseInt(updates.elo)} WHERE user_id = ${userId}`
  if (updates.wins !== undefined) await sql`UPDATE cc_stats SET wins = ${parseInt(updates.wins)} WHERE user_id = ${userId}`
  if (updates.losses !== undefined) await sql`UPDATE cc_stats SET losses = ${parseInt(updates.losses)} WHERE user_id = ${userId}`
  if (updates.embers !== undefined) await sql`UPDATE cc_stats SET embers = ${parseInt(updates.embers)} WHERE user_id = ${userId}`

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

// ═══ GET: Definition overrides (image positioning per god/item type) ═══
async function handleGetDefinitionOverrides(sql, params) {
  const { type } = params || {}
  let overrides
  if (type) {
    overrides = await sql`SELECT * FROM cc_definition_overrides WHERE type = ${type} ORDER BY definition_id`
  } else {
    overrides = await sql`SELECT * FROM cc_definition_overrides ORDER BY type, definition_id`
  }
  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      overrides: overrides.map(o => ({
        id: o.id,
        type: o.type,
        definitionId: o.definition_id,
        metadata: o.metadata || {},
        updatedAt: o.updated_at,
      })),
    }),
  }
}

// ═══ POST: Save definition override (upsert) ═══
async function handleSaveDefinitionOverride(sql, body) {
  const { type, definitionId, metadata } = body
  if (!type || !definitionId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'type and definitionId required' }) }
  }
  const validTypes = ['god', 'item', 'minion', 'buff', 'consumable']
  if (!validTypes.includes(type)) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Invalid type: ${type}` }) }
  }

  const [row] = await sql`
    INSERT INTO cc_definition_overrides (type, definition_id, metadata, updated_at)
    VALUES (${type}, ${definitionId}, ${JSON.stringify(metadata || {})}, NOW())
    ON CONFLICT (type, definition_id)
    DO UPDATE SET metadata = ${JSON.stringify(metadata || {})}, updated_at = NOW()
    RETURNING *
  `

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      override: {
        id: row.id,
        type: row.type,
        definitionId: row.definition_id,
        metadata: row.metadata,
        updatedAt: row.updated_at,
      },
    }),
  }
}

// ═══ POST: Generate share link for a player card preview ═══
async function handleGenerateShareLink(body) {
  const { playerSlug, holoEffect, rarity, holoType } = body
  if (!playerSlug) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'playerSlug required' }) }

  const token = await new SignJWT({
    playerSlug,
    holoEffect: holoEffect || 'gold',
    rarity: rarity || 'legendary',
    holoType: holoType || 'reverse',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({ token }),
  }
}

// ═══ POST: Generate player card definitions for a season ═══
async function handleGeneratePlayerDefs(sql, body) {
  const { seasonId, leagueId } = body
  if (!seasonId && !leagueId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'seasonId or leagueId required' }) }
  }

  let results = []

  if (seasonId) {
    const result = await generatePlayerDefs(sql, parseInt(seasonId))
    results.push({ seasonId: parseInt(seasonId), ...result })
  } else {
    // Generate for all seasons in the league
    const seasons = await sql`
      SELECT s.id FROM seasons s
      JOIN divisions d ON s.division_id = d.id
      WHERE d.league_id = ${parseInt(leagueId)}
    `
    for (const s of seasons) {
      const result = await generatePlayerDefs(sql, s.id)
      results.push({ seasonId: s.id, ...result })
    }
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ results }) }
}

// ═══ POST: Freeze stats for a season ═══
async function handleFreezeSeasonStats(sql, body) {
  const { seasonId } = body
  if (!seasonId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'seasonId required' }) }
  }
  const result = await freezeSeasonStats(sql, parseInt(seasonId))
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(result) }
}

// ═══ POST: Backfill def_id on existing player cards ═══
async function handleBackfillCardDefs(sql) {
  const result = await backfillCardDefs(sql)
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(result) }
}

// ═══ POST: Refresh best_god_name for all player defs missing it ═══
async function handleRefreshBestGods(sql) {
  const defs = await sql`
    SELECT d.id, d.player_id, d.team_id, d.season_id
    FROM cc_player_defs d
    WHERE d.best_god_name IS NULL
  `

  let updated = 0
  for (const def of defs) {
    const [row] = await sql`
      SELECT pgs.god_played FROM player_game_stats pgs
      JOIN league_players lp ON pgs.league_player_id = lp.id
      JOIN games g ON g.id = pgs.game_id AND g.is_completed = true
      JOIN matches m ON g.match_id = m.id
      WHERE lp.player_id = ${def.player_id} AND lp.season_id = ${def.season_id}
        AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${def.team_id}
        AND pgs.god_played IS NOT NULL
      GROUP BY pgs.god_played ORDER BY COUNT(*) DESC, pgs.god_played ASC LIMIT 1
    `
    if (row) {
      await sql`
        UPDATE cc_player_defs SET best_god_name = ${row.god_played}, updated_at = NOW()
        WHERE id = ${def.id}
      `
      updated++
    }
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ checked: defs.length, updated }) }
}

// ═══ POST: Ban a user from the vault ═══
async function handleBanUser(sql, body, admin) {
  const { userId } = body
  if (!userId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }

  await sql`
    INSERT INTO cc_vault_bans (user_id, banned_by)
    VALUES (${userId}, ${admin.id})
    ON CONFLICT (user_id) DO NOTHING
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Unban a user from the vault ═══
async function handleUnbanUser(sql, body) {
  const { userId } = body
  if (!userId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }

  await sql`DELETE FROM cc_vault_bans WHERE user_id = ${userId}`

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

// ═══ GET: All seasons with league info (for player defs tab) ═══
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

// ═══ GET: Preview player-team combos (dry-run) ═══
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

// ═══ POST: Generate only selected player defs ═══
async function handleGenerateSelectedDefs(sql, body) {
  const { entries } = body
  if (!entries?.length) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'entries array required' }) }
  }
  const result = await generateSelectedDefs(sql, entries)
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify(result) }
}

// ═══ POST: Permanently exclude a player-team-season combo ═══
async function handleExcludePlayerDef(sql, body, user) {
  const { playerId, teamId, seasonId } = body
  if (!playerId || !teamId || !seasonId) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'playerId, teamId, seasonId required' }) }
  }
  await sql`
    INSERT INTO cc_player_def_exclusions (player_id, team_id, season_id, excluded_by)
    VALUES (${playerId}, ${teamId}, ${seasonId}, ${user.discord_username || String(user.id)})
    ON CONFLICT (player_id, team_id, season_id) DO NOTHING
  `
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Remove exclusion ═══
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

// ═══ Formatter ═══
function formatAdminCard(row) {
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
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
    imageUrl: row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    createdAt: row.created_at,
  }
}

// ═══ Signature Requests (Admin) ═══

async function handleListSignatureRequests(sql, params) {
  const status = params?.status || 'all'
  const where = status !== 'all' ? sql`AND sr.status = ${status}` : sql``

  const requests = await sql`
    SELECT sr.*, c.god_name, c.rarity, c.card_type, c.image_url, c.signature_url,
           d.player_name, d.team_name, d.player_id,
           u_req.discord_username AS requester_name,
           u_sign.discord_username AS signer_username
    FROM cc_signature_requests sr
    JOIN cc_cards c ON sr.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    LEFT JOIN users u_req ON sr.requester_id = u_req.id
    LEFT JOIN users u_sign ON u_sign.linked_player_id = sr.signer_player_id
    WHERE 1=1 ${where}
    ORDER BY sr.created_at DESC
    LIMIT 100
  `
  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      requests: requests.map(r => ({
        id: r.id, cardId: r.card_id, requesterId: r.requester_id,
        requesterName: r.requester_name, signerPlayerId: r.signer_player_id,
        signerUsername: r.signer_username, playerName: r.player_name,
        teamName: r.team_name, godName: r.god_name, rarity: r.rarity,
        cardType: r.card_type, imageUrl: r.image_url, signatureUrl: r.signature_url,
        status: r.status, createdAt: r.created_at, signedAt: r.signed_at,
      })),
    }),
  }
}

async function handleSearchUniqueCards(sql, body) {
  const { search } = body
  const cards = await sql`
    SELECT c.id, c.god_id, c.god_name, c.card_type, c.image_url, c.rarity, c.signature_url, c.card_data,
           c.owner_id, d.player_name, d.team_name, d.player_id,
           u.discord_username AS owner_name,
           EXISTS(SELECT 1 FROM cc_signature_requests sr WHERE sr.card_id = c.id) AS has_request
    FROM cc_cards c
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.rarity = 'unique'
      AND (${search || ''} = '' OR c.god_name ILIKE ${'%' + (search || '') + '%'} OR d.player_name ILIKE ${'%' + (search || '') + '%'} OR u.discord_username ILIKE ${'%' + (search || '') + '%'})
    ORDER BY c.created_at DESC
    LIMIT 50
  `
  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      cards: cards.map(c => ({
        id: c.id, godName: c.god_name, cardType: c.card_type, imageUrl: c.image_url,
        rarity: c.rarity, signatureUrl: c.signature_url, ownerId: c.owner_id,
        ownerName: c.owner_name, playerName: c.player_name || c.card_data?.teamName, teamName: c.team_name || c.card_data?.teamName,
        playerId: c.player_id || c.card_data?._testPlayerId, hasRequest: c.has_request,
        isTest: (c.god_id || '').startsWith('test-sig-'),
      })),
    }),
  }
}

async function handleAdminRequestSignature(sql, body, adminUser) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'cardId required' }) }

  const [card] = await sql`
    SELECT c.id, c.owner_id, c.rarity, c.signature_url, c.card_data, d.player_id
    FROM cc_cards c
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    WHERE c.id = ${cardId}
  `
  if (!card) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Card not found' }) }
  if (card.rarity !== 'unique') return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Only unique cards' }) }
  if (card.signature_url) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Already signed' }) }

  // Support test cards: player_id from def join, or _testPlayerId from card_data
  const playerId = card.player_id || card.card_data?._testPlayerId
  if (!playerId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Not a player card' }) }

  const [existing] = await sql`SELECT id FROM cc_signature_requests WHERE card_id = ${cardId}`
  if (existing) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Request already exists' }) }

  await sql`
    INSERT INTO cc_signature_requests (card_id, requester_id, signer_player_id)
    VALUES (${cardId}, ${card.owner_id}, ${playerId})
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

async function handleSearchPlayerDefs(sql, params) {
  const q = params?.q || ''
  if (!q) return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ defs: [] }) }
  const defs = await sql`
    SELECT d.id, d.player_id, d.player_name, d.team_name, d.team_color, d.role,
           d.season_slug, d.league_slug, d.division_slug
    FROM cc_player_defs d
    WHERE d.player_name ILIKE ${'%' + q + '%'} OR d.team_name ILIKE ${'%' + q + '%'}
    ORDER BY d.id DESC
    LIMIT 20
  `
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ defs }) }
}

async function handleDeleteSignatureRequest(sql, body) {
  const { requestId } = body
  if (!requestId) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'requestId required' }) }
  await sql`DELETE FROM cc_signature_requests WHERE id = ${requestId}`
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
}

async function handleCreateTestSignatureCard(sql, body, adminUser) {
  const { playerDefId } = body

  // Use a player def for name/team info but do NOT link the card to it (def_id = NULL).
  // This prevents blocking real unique pulls which check: "SELECT 1 FROM cc_cards WHERE def_id = X AND rarity = 'unique'"
  let def
  if (playerDefId) {
    ;[def] = await sql`SELECT id, player_id, player_name, team_name, team_color, role FROM cc_player_defs WHERE id = ${playerDefId} LIMIT 1`
  } else {
    ;[def] = await sql`SELECT id, player_id, player_name, team_name, team_color, role FROM cc_player_defs ORDER BY RANDOM() LIMIT 1`
  }
  if (!def) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'No player defs found' }) }

  const serial = Math.floor(Math.random() * 9999) + 1
  // god_id uses test- prefix, def_id is NULL so it doesn't block real unique pulls.
  // We store the real player_id in card_data so the signature request can still target the right player.
  const [card] = await sql`
    INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id)
    VALUES (${adminUser.id}, ${adminUser.id}, ${'test-sig-' + def.player_id}, ${def.player_name + ' [TEST]'}, 'Warrior', ${def.role || 'solo'}, 'unique', 50, 1, 0, ${serial}, 'unique', 'reverse', '', 'admin_test', 'player',
      ${JSON.stringify({ teamName: def.team_name, teamColor: def.team_color, isConnected: true, _testPlayerId: def.player_id })}, ${null})
    RETURNING *
  `

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      success: true,
      card: { id: card.id, godName: card.god_name, playerName: def.player_name, teamName: def.team_name, playerId: def.player_id },
    }),
  }
}

export const onRequest = adapt(handler)

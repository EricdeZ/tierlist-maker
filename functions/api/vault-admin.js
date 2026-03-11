// Card Clash Admin API — manage cards, view stats, edit metadata
// Permission: cardclash_manage (global only)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { SignJWT } from 'jose'
import { generatePlayerDefs, freezeSeasonStats, backfillCardDefs } from '../lib/vault-defs.js'

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
    SELECT s.user_id, u.discord_name, s.elo, s.wins, s.losses, s.packs_opened, s.embers,
           (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count
    FROM cc_stats s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.elo DESC
    LIMIT 20
  `

  const recentCards = await sql`
    SELECT c.*, u.discord_name AS owner_name
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
      SELECT c.*, u.discord_name AS owner_name
      FROM cc_cards c
      JOIN users u ON u.id = c.owner_id
      WHERE (c.god_name ILIKE ${'%' + search + '%'} OR u.discord_name ILIKE ${'%' + search + '%'})
        AND (${rarity || null}::text IS NULL OR c.rarity = ${rarity})
        AND (${holo || null}::text IS NULL OR c.holo_effect = ${holo})
        AND (${owner || null}::text IS NULL OR c.owner_id = ${parseInt(owner) || 0})
        AND (${god_id || null}::text IS NULL OR c.god_id = ${god_id})
      ORDER BY c.created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `
  } else {
    cards = await sql`
      SELECT c.*, u.discord_name AS owner_name
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
    SELECT c.*, u.discord_name AS owner_name
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
      SELECT s.*, u.discord_name,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
      WHERE u.discord_name ILIKE ${'%' + search + '%'}
      ORDER BY s.elo DESC
      LIMIT ${lim} OFFSET ${off}
    `
  } else {
    users = await sql`
      SELECT s.*, u.discord_name,
             (SELECT COUNT(*)::int FROM cc_cards WHERE owner_id = s.user_id) AS card_count
      FROM cc_stats s
      JOIN users u ON u.id = s.user_id
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
    SELECT c.*, u.discord_name AS owner_name
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
  const { userId, godId, godName, godClass, role, rarity, power, holoEffect, imageUrl } = body
  if (!userId || !godId || !godName) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId, godId, godName required' }) }
  }

  const serialNumber = Math.floor(Math.random() * 9999) + 1

  const [card] = await sql`
    INSERT INTO cc_cards (owner_id, god_id, god_name, god_class, role, rarity, power, level, xp, serial_number, holo_effect, holo_type, image_url, acquired_via)
    VALUES (${userId}, ${godId}, ${godName}, ${godClass || 'Warrior'}, ${role || 'solo'}, ${rarity || 'common'}, ${power || 50}, 1, 0, ${serialNumber}, ${holoEffect || 'common'}, ${rarity && rarity !== 'common' ? ['holo','reverse','full'][Math.floor(Math.random()*3)] : null}, ${imageUrl || ''}, 'admin_grant')
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ card: formatAdminCard(card) }) }
}

// ═══ POST: Delete card ═══
async function handleDeleteCard(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  // Clear from lineups first
  await sql`UPDATE cc_lineups SET card_id = NULL WHERE card_id = ${id}`
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
    imageUrl: row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    createdAt: row.created_at,
  }
}

export const onRequest = adapt(handler)

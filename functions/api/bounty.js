// Bounty Board API — Core-escrowed wanted card requests
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { createBounty, fulfillBounty, cancelBounty, expireStale, BOUNTY_RULES } from '../lib/bounty.js'
import { GODS, ITEMS, CONSUMABLES } from '../lib/vault-data.js'

const VALID_CARD_NAMES = new Set([
  ...GODS.map(g => g.name),
  ...ITEMS.map(i => i.name),
  ...CONSUMABLES.map(c => c.name),
])

const VALID_CARD_TYPES = new Set(['god', 'item', 'consumable', 'player'])
const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'])
const VALID_HOLO_TYPES = new Set(['holo', 'reverse', 'full'])

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  const user = await requireAuth(event)
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'list': return await handleList(sql, event.queryStringParameters)
        case 'my-bounties': return await handleMyBounties(sql, user)
        case 'hero': return await handleHero(sql)
        case 'fulfillable': return await handleFulfillable(sql, user)
        case 'search-players': return await handleSearchPlayers(sql, event.queryStringParameters)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create': return await handleCreate(user, body)
        case 'fulfill': return await handleFulfill(user, body)
        case 'cancel': return await handleCancel(user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('bounty error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ Lazy expiry — cheap check before opening a transaction ═══
async function maybeExpireStale(sql) {
  const [stale] = await sql`
    SELECT 1 FROM cc_bounties
    WHERE status = 'active' AND expires_at < NOW()
    LIMIT 1
  `
  if (stale) {
    await transaction(async (tx) => {
      await expireStale(tx)
    })
  }
}

// ═══ GET: Browse active bounties ═══
async function handleList(sql, params) {
  await maybeExpireStale(sql)

  const {
    page = '0', limit = '24', sort = 'newest',
    rarity, cardType, search, minReward, maxReward, holoType,
  } = params

  const offset = parseInt(page) * parseInt(limit)
  const lim = Math.min(parseInt(limit), 50)

  const rows = await sql`
    SELECT b.id, b.card_type, b.card_name, b.rarity, b.holo_type, b.core_reward, b.created_at, b.expires_at,
      (SELECT pd.avatar_url FROM cc_player_defs pd WHERE pd.player_name = b.card_name AND b.card_type = 'player' LIMIT 1) AS avatar_url
    FROM cc_bounties b
    WHERE b.status = 'active'
    ORDER BY b.created_at DESC
  `

  let filtered = Array.from(rows)

  if (rarity) {
    const rarities = rarity.split(',')
    filtered = filtered.filter(b => rarities.includes(b.rarity))
  }
  if (cardType) {
    const types = cardType.split(',')
    filtered = filtered.filter(b => types.includes(b.card_type))
  }
  if (holoType) {
    const types = holoType.split(',')
    filtered = filtered.filter(b => b.holo_type && types.includes(b.holo_type))
  }
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(b => b.card_name.toLowerCase().includes(q))
  }
  if (minReward) {
    filtered = filtered.filter(b => b.core_reward >= parseInt(minReward))
  }
  if (maxReward) {
    filtered = filtered.filter(b => b.core_reward <= parseInt(maxReward))
  }

  switch (sort) {
    case 'reward_asc': filtered.sort((a, b) => a.core_reward - b.core_reward); break
    case 'reward_desc': filtered.sort((a, b) => b.core_reward - a.core_reward); break
    case 'expiring': filtered.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at)); break
    case 'oldest': filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break
    default: break // newest — already sorted by created_at DESC
  }

  const total = filtered.length
  const pageItems = filtered.slice(offset, offset + lim)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      bounties: pageItems,
      total,
      page: parseInt(page),
      limit: lim,
    }),
  }
}

// ═══ GET: My bounties (active + history) ═══
async function handleMyBounties(sql, user) {
  const rows = await sql`
    SELECT b.*,
           fu.discord_username AS fulfiller_name
    FROM cc_bounties b
    LEFT JOIN users fu ON b.fulfilled_by = fu.id
    WHERE b.poster_id = ${user.id}
    ORDER BY
      CASE b.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 WHEN 'expired' THEN 2 ELSE 3 END,
      b.created_at DESC
  `

  const bounties = Array.from(rows)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      bounties: bounties.map(b => ({
        id: b.id,
        cardType: b.card_type,
        cardName: b.card_name,
        rarity: b.rarity,
        holoType: b.holo_type,
        coreReward: b.core_reward,
        status: b.status,
        createdAt: b.created_at,
        expiresAt: b.expires_at,
        fulfillerName: b.fulfiller_name || null,
        completedAt: b.completed_at,
        cancelledAt: b.cancelled_at,
      })),
      activeCount: bounties.filter(b => b.status === 'active').length,
      maxBounties: BOUNTY_RULES.max_active,
    }),
  }
}

// ═══ GET: Top 5 bounties by reward ═══
async function handleHero(sql) {
  await maybeExpireStale(sql)

  const rows = await sql`
    SELECT b.id, b.card_type, b.card_name, b.rarity, b.holo_type, b.core_reward, b.created_at, b.expires_at,
      (SELECT pd.avatar_url FROM cc_player_defs pd WHERE pd.player_name = b.card_name AND b.card_type = 'player' LIMIT 1) AS avatar_url
    FROM cc_bounties b
    WHERE b.status = 'active'
    ORDER BY b.core_reward DESC
    LIMIT 5
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ bounties: Array.from(rows) }),
  }
}

// ═══ GET: Bounty IDs the user can fulfill ═══
async function handleFulfillable(sql, user) {
  const rows = await sql`
    SELECT DISTINCT b.id AS bounty_id
    FROM cc_bounties b
    JOIN cc_cards c ON c.card_type = b.card_type
      AND c.god_name = b.card_name
      AND c.rarity = b.rarity
      AND (b.holo_type IS NULL OR c.holo_type = b.holo_type)
    WHERE b.status = 'active'
      AND c.owner_id = ${user.id}
      AND NOT EXISTS (
        SELECT 1 FROM cc_trade_cards tc
        JOIN cc_trades t ON tc.trade_id = t.id
        WHERE tc.card_id = c.id AND t.status IN ('waiting', 'active')
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_lineups
        WHERE user_id = ${user.id} AND (card_id = c.id OR god_card_id = c.id OR item_card_id = c.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_binder_cards WHERE card_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_market_listings WHERE card_id = c.id AND status = 'active'
      )
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ fulfillableIds: rows.map(r => r.bounty_id) }),
  }
}

// ═══ GET: Search player defs for autocomplete ═══
async function handleSearchPlayers(sql, params) {
  const { q } = params
  if (!q || q.trim().length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ players: [] }) }
  }
  const term = `%${q.trim()}%`
  const rows = await sql`
    SELECT DISTINCT ON (pd.player_name)
      pd.player_name, pd.team_name, pd.team_color, pd.role, pd.avatar_url
    FROM cc_player_defs pd
    WHERE pd.player_name ILIKE ${term}
    ORDER BY pd.player_name
    LIMIT 15
  `
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ players: Array.from(rows) }),
  }
}

// ═══ POST: Create bounty ═══
async function handleCreate(user, body) {
  const { cardType, cardName, rarity, holoType, coreReward } = body
  if (!cardType || !cardName || !rarity || !coreReward) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardType, cardName, rarity, and coreReward required' }) }
  }
  if (!VALID_CARD_TYPES.has(cardType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid card type: ${cardType}` }) }
  }
  if (!VALID_RARITIES.has(rarity)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid rarity: ${rarity}` }) }
  }
  if (holoType && !VALID_HOLO_TYPES.has(holoType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid holo type: ${holoType}` }) }
  }
  // Validate card name for non-player types (player names are dynamic)
  if (cardType !== 'player' && !VALID_CARD_NAMES.has(cardName)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown card name: ${cardName}` }) }
  }

  const parsedReward = parseInt(coreReward)

  const bounty = await transaction(async (tx) => {
    return await createBounty(tx, user.id, {
      cardType, cardName, rarity, holoType: holoType || null, coreReward: parsedReward,
    })
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ bounty: { id: bounty.id, status: bounty.status } }),
  }
}

// ═══ POST: Fulfill bounty ═══
async function handleFulfill(user, body) {
  const { bountyId, cardId } = body
  if (!bountyId || !cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'bountyId and cardId required' }) }
  }

  const result = await transaction(async (tx) => {
    return await fulfillBounty(tx, user.id, { bountyId: parseInt(bountyId), cardId: parseInt(cardId) })
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      reward: result.reward,
    }),
  }
}

// ═══ POST: Cancel bounty ═══
async function handleCancel(user, body) {
  const { bountyId } = body
  if (!bountyId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'bountyId required' }) }
  }

  const result = await transaction(async (tx) => {
    return await cancelBounty(tx, user.id, parseInt(bountyId))
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      fee: result.fee,
      refund: result.refund,
    }),
  }
}


export const onRequest = adapt(handler)

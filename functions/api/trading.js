// Card Clash Trading API — direct player-to-player card + Core swaps
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  createTrade, joinTrade, cancelTrade,
  addCard, removeCard, setCore, setReady,
  confirmTrade, pollTrade, expireStale,
} from '../lib/trading.js'
import { pushChallengeProgress, getVaultStats } from '../lib/challenges.js'

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
        case 'poll': return await handlePoll(sql, user, event.queryStringParameters)
        case 'pending': return await handlePending(sql, user)
        case 'history': return await handleHistory(sql, user)
        case 'search-users': return await handleSearchUsers(sql, event.queryStringParameters)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create': return await handleCreate(sql, user, body)
        case 'join': return await handleJoin(sql, user, body)
        case 'add-card': return await handleAddCard(user, body)
        case 'remove-card': return await handleRemoveCard(sql, user, body)
        case 'set-core': return await handleSetCore(sql, user, body)
        case 'ready': return await handleReady(sql, user, body)
        case 'confirm': return await handleConfirm(user, body)
        case 'cancel': return await handleCancel(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('trading error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Poll trade state ═══
async function handlePoll(sql, user, params) {
  const { tradeId } = params
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const { trade, cards } = await pollTrade(sql, user.id, parseInt(tradeId))

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trade: formatTrade(trade, user.id), cards: cards.map(formatTradeCard) }),
  }
}

// ═══ GET: Pending invites ═══
async function handlePending(sql, user) {
  await expireStale(sql)

  const trades = await sql`
    SELECT t.*, u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${user.id} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('waiting', 'active')
    ORDER BY t.created_at DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trades: trades.map(t => formatPendingTrade(t, user.id)) }),
  }
}

// ═══ GET: Trade history ═══
async function handleHistory(sql, user) {
  const trades = await sql`
    SELECT t.*, u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${user.id} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${user.id} OR t.player_b_id = ${user.id})
      AND t.status IN ('completed', 'cancelled', 'expired')
    ORDER BY t.updated_at DESC
    LIMIT 20
  `
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ trades: trades.map(t => formatPendingTrade(t, user.id)) }),
  }
}

// ═══ GET: Search users ═══
async function handleSearchUsers(sql, params) {
  const { q } = params
  if (!q || q.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query must be at least 2 characters' }) }
  }

  const users = await sql`
    SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id
    FROM users u
    WHERE u.discord_username ILIKE ${'%' + q + '%'}
    ORDER BY u.discord_username
    LIMIT 20
  `
  return { statusCode: 200, headers, body: JSON.stringify({ users }) }
}

// ═══ POST: Create trade ═══
async function handleCreate(sql, user, body) {
  const { targetUserId } = body
  if (!targetUserId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUserId required' }) }

  const trade = await createTrade(sql, user.id, parseInt(targetUserId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade: { id: trade.id, status: trade.status } }) }
}

// ═══ POST: Join trade ═══
async function handleJoin(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const trade = await joinTrade(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade: { id: trade.id, status: trade.status } }) }
}

// ═══ POST: Add card to trade ═══
async function handleAddCard(user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }

  await transaction(async (tx) => {
    await addCard(tx, user.id, parseInt(tradeId), parseInt(cardId))
  })
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Remove card from trade ═══
async function handleRemoveCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }

  await removeCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Set Core offer ═══
async function handleSetCore(sql, user, body) {
  const { tradeId, amount } = body
  if (!tradeId || amount === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and amount required' }) }

  await setCore(sql, user.id, parseInt(tradeId), parseInt(amount))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Set ready ═══
async function handleReady(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  await setReady(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Confirm trade ═══
async function handleConfirm(user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  const sql = getDB()
  const result = await transaction(async (tx) => {
    return await confirmTrade(tx, user.id, parseInt(tradeId))
  })

  // Push vault challenge progress for both traders (fire-and-forget)
  if (result.status === 'completed' && result.trade) {
    const pushForUser = (uid) =>
      getVaultStats(sql, uid)
        .then(stats => pushChallengeProgress(sql, uid, stats))
        .catch(err => console.error('Vault challenge push (trade) failed:', err))
    pushForUser(result.trade.player_a_id)
    pushForUser(result.trade.player_b_id)
  }

  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

// ═══ POST: Cancel trade ═══
async function handleCancel(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }

  await cancelTrade(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ Formatters ═══
function formatTrade(trade, userId) {
  const isA = trade.player_a_id === userId
  return {
    id: trade.id,
    status: trade.status,
    myCore: isA ? trade.player_a_core : trade.player_b_core,
    theirCore: isA ? trade.player_b_core : trade.player_a_core,
    myReady: isA ? trade.player_a_ready : trade.player_b_ready,
    theirReady: isA ? trade.player_b_ready : trade.player_a_ready,
    myConfirmed: isA ? trade.player_a_confirmed : trade.player_b_confirmed,
    theirConfirmed: isA ? trade.player_b_confirmed : trade.player_a_confirmed,
    partnerId: isA ? trade.player_b_id : trade.player_a_id,
    partnerName: isA ? trade.player_b_name : trade.player_a_name,
    partnerAvatar: avatarUrl(
      isA ? trade.player_b_discord_id : trade.player_a_discord_id,
      isA ? trade.player_b_avatar : trade.player_a_avatar
    ),
    createdAt: trade.created_at,
    updatedAt: trade.updated_at,
  }
}

function formatPendingTrade(trade, userId) {
  const isA = trade.player_a_id === userId
  return {
    id: trade.id,
    status: trade.status,
    isInitiator: isA,
    partnerId: isA ? trade.player_b_id : trade.player_a_id,
    partnerName: trade.partner_name,
    partnerAvatar: avatarUrl(trade.partner_discord_id, trade.partner_avatar),
    createdAt: trade.created_at,
    completedAt: trade.completed_at,
  }
}

function formatTradeCard(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    offeredBy: row.offered_by,
    card: {
      godId: row.god_id,
      godName: row.god_name,
      godClass: row.god_class,
      role: row.role,
      rarity: row.rarity,
      holoEffect: row.holo_effect,
      holoType: row.holo_type,
      imageUrl: row.card_type === 'player' && row.image_url && !row.image_url.includes('cdn.discordapp.com')
        ? '' : row.image_url,
      cardType: row.card_type,
      cardData: row.card_data,
      serialNumber: row.serial_number,
      defId: row.def_id,
      bestGodName: row.best_god_name || null,
    },
  }
}

function avatarUrl(discordId, avatar) {
  return discordId && avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.webp?size=64`
    : null
}

export const onRequest = adapt(handler)

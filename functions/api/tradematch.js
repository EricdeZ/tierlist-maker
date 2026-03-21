// Tradematch API — Tinder-style card trading matchmaker
import { adapt } from '../lib/adapter.js'
import { getDB, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import {
  getTradePile, addToTradePile, removeFromTradePile, getTradePileCount,
  getSwipeFeed, recordSwipe,
  getLikes, createTradeFromLike,
  getMatches,
  TRADEMATCH_RULES,
} from '../lib/tradematch.js'

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

  // Ban check
  const [ban] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`
  if (ban) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Vault access revoked' }) }

  // Account age check — 30-day minimum
  const discordEpoch = 1420070400000n
  const discordCreatedAt = Number((BigInt(user.discord_id) >> 22n) + discordEpoch)
  if (Date.now() - discordCreatedAt < 30 * 24 * 60 * 60 * 1000) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Account too new' }) }
  }

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'trade-pile': return await handleGetTradePile(sql, user)
        case 'trade-pile-view': return await handleViewTradePile(sql, event.queryStringParameters)
        case 'swipe-feed': return await handleSwipeFeed(sql, user, event.queryStringParameters)
        case 'likes': return await handleLikes(sql, user)
        case 'matches': return await handleMatches(sql, user)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'trade-pile-add': return await handleTradePileAdd(sql, user, body)
        case 'trade-pile-remove': return await handleTradePileRemove(sql, user, body)
        case 'swipe': return await handleSwipe(sql, user, body)
        case 'likes-trade': return await handleLikesTrade(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    const msg = err.message || 'Internal error'
    const status = msg.includes('not found') || msg.includes('not available') ? 404
      : msg.includes('do not own') || msg.includes('Login') ? 403
      : msg.includes('Too many') || msg.includes('locked') || msg.includes('already') ? 409
      : 400
    return { statusCode: status, headers, body: JSON.stringify({ error: msg }) }
  }
}

async function handleGetTradePile(sql, user) {
  const [cards, count] = await Promise.all([
    getTradePile(sql, user.id),
    getTradePileCount(sql, user.id),
  ])
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ cards, count, minRequired: TRADEMATCH_RULES.min_trade_pile }),
  }
}

async function handleViewTradePile(sql, params) {
  const userId = parseInt(params.userId)
  if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId required' }) }
  const cards = await getTradePile(sql, userId)
  return { statusCode: 200, headers, body: JSON.stringify({ cards }) }
}

async function handleTradePileAdd(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  await addToTradePile(sql, user.id, parseInt(cardId))
  const count = await getTradePileCount(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count }) }
}

async function handleTradePileRemove(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  await removeFromTradePile(sql, user.id, parseInt(cardId))
  const count = await getTradePileCount(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count }) }
}

async function handleSwipeFeed(sql, user, params) {
  const count = await getTradePileCount(sql, user.id)
  if (count < TRADEMATCH_RULES.min_trade_pile) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ cards: [], locked: true, count, minRequired: TRADEMATCH_RULES.min_trade_pile }),
    }
  }
  const offset = parseInt(params.offset) || 0
  const cards = await getSwipeFeed(sql, user.id, offset)
  return { statusCode: 200, headers, body: JSON.stringify({ cards, locked: false }) }
}

async function handleSwipe(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }

  const count = await getTradePileCount(sql, user.id)
  if (count < TRADEMATCH_RULES.min_trade_pile) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need at least 20 cards in trade pile' }) }
  }

  const result = await recordSwipe(sql, user.id, parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleLikes(sql, user) {
  const likes = await getLikes(sql, user.id)
  // Group by swiper
  const grouped = {}
  for (const like of likes) {
    if (!grouped[like.swiper_id]) {
      grouped[like.swiper_id] = {
        user_id: like.swiper_id,
        username: like.swiper_name,
        avatar: like.swiper_avatar,
        discord_id: like.swiper_discord_id,
        cards: [],
      }
    }
    grouped[like.swiper_id].cards.push(like)
  }
  return { statusCode: 200, headers, body: JSON.stringify({ likes: Object.values(grouped) }) }
}

async function handleLikesTrade(sql, user, body) {
  const { likerId, cardId } = body
  if (!likerId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'likerId and cardId required' }) }
  const trade = await createTradeFromLike(sql, user.id, parseInt(likerId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ trade_id: trade.id }) }
}

async function handleMatches(sql, user) {
  const matches = await getMatches(sql, user.id)
  return { statusCode: 200, headers, body: JSON.stringify({ matches }) }
}

export const onRequest = adapt(handler)

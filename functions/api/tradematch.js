// Tradematch API — Tinder-style card trading matchmaker
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { getVaultStats, pushChallengeProgress } from '../lib/challenges.js'
import {
  getTradePile, addToTradePile, removeFromTradePile, getTradePileCount,
  getSwipeFeed, recordSwipe, deleteSwipe,
  getLikes, createTradeFromLike,
  getMatches, getOfferDetail,
  offerAddCard, offerRemoveCard, offerSetCore, offerSend, offerAccept, offerCancel,
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
        case 'offer-detail': return await handleOfferDetail(sql, user, event.queryStringParameters)
        case 'pending-count': return await handlePendingCount(sql, user)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'trade-pile-add': return await handleTradePileAdd(sql, user, body)
        case 'trade-pile-remove': return await handleTradePileRemove(sql, user, body)
        case 'swipe': return await handleSwipe(sql, user, body)
        case 'unswipe': return await handleUnswipe(sql, user, body)
        case 'likes-trade': return await handleLikesTrade(sql, user, body)
        case 'offer-add-card': return await handleOfferAddCard(sql, user, body)
        case 'offer-remove-card': return await handleOfferRemoveCard(sql, user, body)
        case 'offer-set-core': return await handleOfferSetCore(sql, user, body)
        case 'offer-send': return await handleOfferSend(sql, user, body)
        case 'offer-accept': return await handleOfferAcceptRoute(user, body)
        case 'offer-cancel': return await handleOfferCancel(sql, user, body)
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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need at least 10 cards in trade pile' }) }
  }

  const result = await recordSwipe(sql, user.id, parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleUnswipe(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  const result = await deleteSwipe(sql, user.id, parseInt(cardId))
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

async function handlePendingCount(sql, user) {
  const [row] = await sql`
    SELECT COUNT(*) FILTER (WHERE offer_status = 'pending' AND offer_by != ${user.id})::int AS pending,
           COUNT(*) FILTER (WHERE offer_status = 'negotiating' AND offer_by IS NULL)::int AS new_matches,
           COUNT(*)::int AS total
    FROM cc_trades
    WHERE (player_a_id = ${user.id} OR player_b_id = ${user.id})
      AND mode = 'match' AND status = 'active'
  `
  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      total: row?.total || 0,
      pending: (row?.pending || 0) + (row?.new_matches || 0),
    }),
  }
}

async function handleOfferDetail(sql, user, params) {
  const tradeId = parseInt(params.tradeId)
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  const result = await getOfferDetail(sql, user.id, tradeId)
  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleOfferAddCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }
  await offerAddCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferRemoveCard(sql, user, body) {
  const { tradeId, cardId } = body
  if (!tradeId || !cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and cardId required' }) }
  await offerRemoveCard(sql, user.id, parseInt(tradeId), parseInt(cardId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferSetCore(sql, user, body) {
  const { tradeId, amount } = body
  if (!tradeId || amount === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and amount required' }) }
  await offerSetCore(sql, user.id, parseInt(tradeId), parseInt(amount))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferSend(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  await offerSend(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

async function handleOfferAcceptRoute(user, body) {
  const { tradeId, version } = body
  if (!tradeId || version === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId and version required' }) }
  const sql = getDB()
  const result = await transaction(async (tx) => {
    return offerAccept(tx, user.id, parseInt(tradeId), parseInt(version))
  })

  // Push vault challenge progress for both traders (fire-and-forget)
  if (result.status === 'completed' && result.trade) {
    const pushForUser = (uid) =>
      getVaultStats(sql, uid)
        .then(stats => pushChallengeProgress(sql, uid, stats))
        .catch(err => console.error('Vault challenge push (tradematch) failed:', err))
    pushForUser(result.trade.player_a_id)
    pushForUser(result.trade.player_b_id)
  }

  return { statusCode: 200, headers, body: JSON.stringify(result) }
}

async function handleOfferCancel(sql, user, body) {
  const { tradeId } = body
  if (!tradeId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'tradeId required' }) }
  await offerCancel(sql, user.id, parseInt(tradeId))
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}

export const onRequest = adapt(handler)

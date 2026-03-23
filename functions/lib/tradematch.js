import { grantEmber, ensureEmberBalance } from './ember.js'

// Tradematch — Tinder-style card trading matchmaker
// Discovery layer: trade pile, swipe feed, match detection, likes

export const TRADEMATCH_RULES = {
  min_trade_pile: 10,
  max_outgoing_matches: 15,
  max_cards_per_side: 10,
  match_expiry_hours: 24,
  feed_page_size: 50,
}

// ══════════════════════════════════════════════
// Trade Pile
// ══════════════════════════════════════════════

export async function getTradePile(sql, userId) {
  return sql`
    SELECT tp.id, tp.card_id, tp.created_at,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id, c.card_type
    FROM cc_trade_pile tp
    JOIN cc_cards c ON tp.card_id = c.id
    WHERE tp.user_id = ${userId}
    ORDER BY tp.created_at DESC
  `
}

export async function addToTradePile(sql, userId, cardId) {
  // Verify ownership + rarity
  const [card] = await sql`SELECT id, owner_id, rarity FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')
  if (card.rarity === 'common' || card.rarity === 'uncommon') throw new Error('Only rare or higher cards can be traded')

  // Check not in Starting 5
  const [inLineup] = await sql`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${userId}
    LIMIT 1
  `
  if (inLineup) throw new Error('Card is in your Starting 5 lineup')

  // Check not in binder
  const [inBinder] = await sql`SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1`
  if (inBinder) throw new Error('Card is in your binder')

  // Check not on marketplace
  const [onMarket] = await sql`SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active' LIMIT 1`
  if (onMarket) throw new Error('Card is listed on the marketplace')

  // Check not in active direct trade
  const [inTrade] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  if (inTrade) throw new Error('Card is locked in a direct trade')

  await sql`INSERT INTO cc_trade_pile (user_id, card_id) VALUES (${userId}, ${cardId}) ON CONFLICT DO NOTHING`
}

export async function removeFromTradePile(sql, userId, cardId) {
  await sql`DELETE FROM cc_trade_pile WHERE user_id = ${userId} AND card_id = ${cardId}`
}

export async function getTradePileCount(sql, userId) {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM cc_trade_pile WHERE user_id = ${userId}`
  return count
}

// ══════════════════════════════════════════════
// Swipe Feed
// ══════════════════════════════════════════════

export async function getSwipeFeed(sql, userId, offset = 0) {
  const limit = TRADEMATCH_RULES.feed_page_size

  return sql`
    WITH my_pile AS (
      SELECT card_id FROM cc_trade_pile WHERE user_id = ${userId}
    ),
    my_gods AS (
      SELECT DISTINCT god_id, rarity FROM cc_cards WHERE owner_id = ${userId}
    ),
    boost_users AS (
      SELECT DISTINCT s.swiper_id AS user_id
      FROM cc_swipes s
      JOIN my_pile mp ON s.card_id = mp.card_id
      WHERE s.card_owner_id = ${userId}
    )
    SELECT tp.card_id, tp.user_id AS owner_id,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id, c.card_type,
           u.discord_username AS owner_name, u.discord_avatar AS owner_avatar, u.discord_id AS owner_discord_id,
           CASE WHEN bu.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_boost,
           CASE WHEN mg.god_id IS NULL THEN 1 ELSE 0 END AS is_novel
    FROM cc_trade_pile tp
    JOIN cc_cards c ON tp.card_id = c.id
    JOIN users u ON tp.user_id = u.id
    LEFT JOIN cc_swipes sw ON sw.swiper_id = ${userId} AND sw.card_id = tp.card_id
    LEFT JOIN boost_users bu ON tp.user_id = bu.user_id
    LEFT JOIN my_gods mg ON c.god_id = mg.god_id AND c.rarity = mg.rarity
    WHERE tp.user_id != ${userId}
      AND sw.id IS NULL
      AND c.rarity NOT IN ('common', 'uncommon')
    ORDER BY has_boost DESC, is_novel DESC, md5(${userId} || ':' || tp.card_id)
    LIMIT ${limit} OFFSET ${offset}
  `
}

// ══════════════════════════════════════════════
// Swipe + Match Detection
// ══════════════════════════════════════════════

export async function recordSwipe(sql, swiperId, cardId) {
  // Verify card exists and is in someone's trade pile
  const [tpEntry] = await sql`
    SELECT tp.user_id AS card_owner_id
    FROM cc_trade_pile tp
    WHERE tp.card_id = ${cardId} AND tp.user_id != ${swiperId}
  `
  if (!tpEntry) throw new Error('Card not available')

  const cardOwnerId = tpEntry.card_owner_id

  // Check outgoing match cap
  const [{ count: outgoing }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trades
    WHERE player_a_id = ${swiperId} AND mode = 'match' AND status = 'active'
  `
  if (outgoing >= TRADEMATCH_RULES.max_outgoing_matches) {
    throw new Error('Too many active matches — handle existing matches first')
  }

  // Record swipe (ignore duplicate via ON CONFLICT)
  await sql`
    INSERT INTO cc_swipes (swiper_id, card_id, card_owner_id)
    VALUES (${swiperId}, ${cardId}, ${cardOwnerId})
    ON CONFLICT (swiper_id, card_id) DO NOTHING
  `

  // Check for match: does card owner have a swipe on any of swiper's trade pile cards?
  const [matchSwipe] = await sql`
    SELECT s.id AS swipe_id, s.card_id
    FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${swiperId}
    WHERE s.swiper_id = ${cardOwnerId}
    LIMIT 1
  `

  if (!matchSwipe) return { matched: false }

  // Get swiper's swipe ID
  const [mySwipe] = await sql`
    SELECT id FROM cc_swipes WHERE swiper_id = ${swiperId} AND card_id = ${cardId}
  `

  // Create match trade
  let trade
  try {
    ;[trade] = await sql`
      INSERT INTO cc_trades (player_a_id, player_b_id, mode, status, match_swipe_a_id, match_swipe_b_id)
      VALUES (${swiperId}, ${cardOwnerId}, 'match', 'active', ${mySwipe.id}, ${matchSwipe.swipe_id})
      RETURNING *
    `
  } catch (e) {
    // Duplicate match pair — already matched with this user
    if (e.code === '23505') return { matched: false }
    throw e
  }

  // Pre-load both matched cards
  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${trade.id}, ${cardId}, ${cardOwnerId}),
           (${trade.id}, ${matchSwipe.card_id}, ${swiperId})
  `

  // Return match info
  const [theirCard] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c JOIN users u ON c.owner_id = u.id
    WHERE c.id = ${cardId}
  `
  const [myCard] = await sql`
    SELECT c.*, u.discord_username AS owner_name
    FROM cc_cards c JOIN users u ON c.owner_id = u.id
    WHERE c.id = ${matchSwipe.card_id}
  `

  return {
    matched: true,
    trade_id: trade.id,
    their_card: theirCard,
    my_card: myCard,
  }
}

// ══════════════════════════════════════════════
// Likes
// ══════════════════════════════════════════════

export async function getLikes(sql, userId) {
  // Get swipes on my trade pile cards, grouped by user, filtered to valid/current
  return sql`
    SELECT s.id AS swipe_id, s.swiper_id, s.card_id, s.created_at,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level, c.card_data,
           u.discord_username AS swiper_name, u.discord_avatar AS swiper_avatar, u.discord_id AS swiper_discord_id
    FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${userId}
    JOIN cc_cards c ON s.card_id = c.id
    JOIN users u ON s.swiper_id = u.id
    WHERE s.card_owner_id = ${userId}
      AND c.owner_id = ${userId}
    ORDER BY s.created_at DESC
  `
}

export async function createTradeFromLike(sql, initiatorId, likerId, cardId) {
  // Verify the like exists and card is still valid
  const [swipe] = await sql`
    SELECT s.id FROM cc_swipes s
    JOIN cc_trade_pile tp ON s.card_id = tp.card_id AND tp.user_id = ${initiatorId}
    WHERE s.swiper_id = ${likerId} AND s.card_id = ${cardId} AND s.card_owner_id = ${initiatorId}
  `
  if (!swipe) throw new Error('Like not found or card no longer in trade pile')

  // Check outgoing match cap
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trades
    WHERE player_a_id = ${initiatorId} AND mode = 'match' AND status = 'active'
  `
  if (count >= TRADEMATCH_RULES.max_outgoing_matches) {
    throw new Error('Too many active matches')
  }

  // Create match trade
  let trade
  try {
    ;[trade] = await sql`
      INSERT INTO cc_trades (player_a_id, player_b_id, mode, status, match_swipe_b_id)
      VALUES (${initiatorId}, ${likerId}, 'match', 'active', ${swipe.id})
      RETURNING *
    `
  } catch (e) {
    if (e.code === '23505') throw new Error('Already in an active match with this user')
    throw e
  }

  // Pre-load the liked card (initiator offers it)
  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${trade.id}, ${cardId}, ${initiatorId})
  `

  return trade
}

// ══════════════════════════════════════════════
// Active Matches
// ══════════════════════════════════════════════

export async function getMatches(sql, userId) {
  return sql`
    SELECT t.id, t.player_a_id, t.player_b_id, t.status, t.mode,
           t.player_a_core, t.player_b_core,
           t.offer_by, t.offer_status, t.offer_version,
           t.created_at, t.updated_at,
           u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${userId} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
      AND t.mode = 'match'
      AND t.status = 'active'
    ORDER BY t.updated_at DESC
  `
}

// ══════════════════════════════════════════════
// Offer Negotiation
// ══════════════════════════════════════════════

export async function getOfferDetail(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT t.id, t.player_a_id, t.player_b_id, t.status, t.mode,
           t.player_a_core, t.player_b_core,
           t.offer_by, t.offer_status, t.offer_version,
           t.created_at, t.updated_at,
           ua.discord_username AS player_a_name, ua.discord_avatar AS player_a_avatar, ua.discord_id AS player_a_discord_id,
           ub.discord_username AS player_b_name, ub.discord_avatar AS player_b_avatar, ub.discord_id AS player_b_discord_id
    FROM cc_trades t
    JOIN users ua ON t.player_a_id = ua.id
    JOIN users ub ON t.player_b_id = ub.id
    WHERE t.id = ${tradeId}
      AND t.mode = 'match'
      AND (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')
  if (trade.status !== 'active') throw new Error('Trade is no longer active')

  const cards = await sql`
    SELECT tc.id, tc.card_id, tc.offered_by,
           c.god_id, c.god_name, c.rarity, c.serial_number, c.image_url,
           c.holo_effect, c.holo_type, c.power, c.level,
           c.card_data, c.def_id, c.card_type, c.owner_id,
           c.template_id
    FROM cc_trade_cards tc
    JOIN cc_cards c ON tc.card_id = c.id
    WHERE tc.trade_id = ${tradeId}
  `

  const cardIds = cards.map(c => c.card_id)

  const lockedInTrade = cardIds.length > 0 ? await sql`
    SELECT DISTINCT tc2.card_id FROM cc_trade_cards tc2
    JOIN cc_trades t2 ON tc2.trade_id = t2.id
    WHERE tc2.card_id = ANY(${cardIds}) AND t2.status IN ('waiting', 'active') AND t2.mode = 'direct'
  ` : []
  const tradeLockedSet = new Set(lockedInTrade.map(r => r.card_id))

  const onMarketplace = cardIds.length > 0 ? await sql`
    SELECT DISTINCT card_id FROM cc_market_listings
    WHERE card_id = ANY(${cardIds}) AND status = 'active'
  ` : []
  const marketLockedSet = new Set(onMarketplace.map(r => r.card_id))

  const enrichedCards = cards.map(card => ({
    ...card,
    available: card.owner_id === card.offered_by
      && !tradeLockedSet.has(card.card_id)
      && !marketLockedSet.has(card.card_id),
  }))

  return { trade, cards: enrichedCards }
}

export async function offerAddCard(sql, userId, tradeId, cardId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  if (trade.offer_status === 'pending' && trade.offer_by === userId) {
    throw new Error('Waiting for the other player to respond')
  }
  if (trade.offer_status === 'negotiating' && trade.offer_by && trade.offer_by !== userId) {
    throw new Error('Waiting for the other player to send their offer')
  }
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', offer_by = ${userId}, updated_at = NOW() WHERE id = ${tradeId}`
  }

  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')

  const offeredBy = card.owner_id
  if (offeredBy !== trade.player_a_id && offeredBy !== trade.player_b_id) {
    throw new Error('Card does not belong to either trader')
  }

  const [inPile] = await sql`
    SELECT 1 FROM cc_trade_pile WHERE user_id = ${offeredBy} AND card_id = ${cardId}
  `
  if (!inPile) throw new Error('Card is not in trade pile')

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${offeredBy}
  `
  if (count >= TRADEMATCH_RULES.max_cards_per_side) {
    throw new Error(`Maximum ${TRADEMATCH_RULES.max_cards_per_side} cards per side`)
  }

  await sql`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${tradeId}, ${cardId}, ${offeredBy})
    ON CONFLICT (trade_id, card_id) DO NOTHING
  `
}

export async function offerRemoveCard(sql, userId, tradeId, cardId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  if (trade.offer_status === 'pending' && trade.offer_by === userId) {
    throw new Error('Waiting for the other player to respond')
  }
  if (trade.offer_status === 'negotiating' && trade.offer_by && trade.offer_by !== userId) {
    throw new Error('Waiting for the other player to send their offer')
  }
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', offer_by = ${userId}, updated_at = NOW() WHERE id = ${tradeId}`
  }

  await sql`DELETE FROM cc_trade_cards WHERE trade_id = ${tradeId} AND card_id = ${cardId}`
}

export async function offerSetCore(sql, userId, tradeId, amount) {
  const amt = Math.max(0, Math.floor(amount))

  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  if (trade.offer_status === 'pending' && trade.offer_by === userId) {
    throw new Error('Waiting for the other player to respond')
  }
  if (trade.offer_status === 'negotiating' && trade.offer_by && trade.offer_by !== userId) {
    throw new Error('Waiting for the other player to send their offer')
  }
  if (trade.offer_status === 'pending' && trade.offer_by !== userId) {
    await sql`UPDATE cc_trades SET offer_status = 'negotiating', offer_by = ${userId}, updated_at = NOW() WHERE id = ${tradeId}`
  }

  const isA = trade.player_a_id === userId
  if (isA) {
    await sql`UPDATE cc_trades SET player_a_core = ${amt}, updated_at = NOW() WHERE id = ${tradeId}`
  } else {
    await sql`UPDATE cc_trades SET player_b_core = ${amt}, updated_at = NOW() WHERE id = ${tradeId}`
  }
}

export async function offerSend(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  if (trade.offer_status === 'pending' && trade.offer_by === userId) {
    throw new Error('Already sent — waiting for the other player to respond')
  }

  const isA = trade.player_a_id === userId
  const myCore = isA ? trade.player_a_core : trade.player_b_core

  const [{ count: myCardCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId}
  `
  if (myCardCount === 0 && myCore === 0) {
    throw new Error('You must offer at least one card or some Cores')
  }

  await sql`
    UPDATE cc_trades
    SET offer_by = ${userId}, offer_status = 'pending', offer_version = offer_version + 1, updated_at = NOW()
    WHERE id = ${tradeId}
  `
}

export async function offerAccept(tx, userId, tradeId, version) {
  const [trade] = await tx`
    SELECT * FROM cc_trades WHERE id = ${tradeId} AND mode = 'match' AND status = 'active' FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  const isA = trade.player_a_id === userId
  const isB = trade.player_b_id === userId
  if (!isA && !isB) throw new Error('You are not in this trade')

  if (trade.offer_status !== 'pending') throw new Error('No pending offer to accept')
  if (trade.offer_by === userId) throw new Error('You cannot accept your own offer')

  if (trade.offer_version !== version) throw new Error('Offer has changed — please review the updated offer')

  const items = await tx`SELECT * FROM cc_trade_cards WHERE trade_id = ${tradeId}`
  const aCards = items.filter(c => c.offered_by === trade.player_a_id)
  const bCards = items.filter(c => c.offered_by === trade.player_b_id)

  if (items.length === 0 && trade.player_a_core === 0 && trade.player_b_core === 0) {
    throw new Error('Trade is empty')
  }

  for (const tc of items) {
    const [card] = await tx`SELECT owner_id FROM cc_cards WHERE id = ${tc.card_id} FOR UPDATE`
    if (!card || card.owner_id !== tc.offered_by) {
      throw new Error('A card in the trade is no longer owned by the trader')
    }
    const [locked] = await tx`
      SELECT 1 FROM cc_trade_cards tc2
      JOIN cc_trades t2 ON tc2.trade_id = t2.id
      WHERE tc2.card_id = ${tc.card_id} AND t2.status IN ('waiting', 'active') AND t2.mode = 'direct'
      LIMIT 1
    `
    if (locked) throw new Error('A card is locked in a direct trade')

    const [onMarket] = await tx`
      SELECT 1 FROM cc_market_listings WHERE card_id = ${tc.card_id} AND status = 'active' LIMIT 1
    `
    if (onMarket) throw new Error('A card is listed on the marketplace')
  }

  if (trade.player_a_core > 0) {
    await ensureEmberBalance(tx, trade.player_a_id)
    const [balA] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${trade.player_a_id} FOR UPDATE`
    if (!balA || balA.balance < trade.player_a_core) throw new Error('Player cannot afford their Core offer')
  }
  if (trade.player_b_core > 0) {
    await ensureEmberBalance(tx, trade.player_b_id)
    const [balB] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${trade.player_b_id} FOR UPDATE`
    if (!balB || balB.balance < trade.player_b_core) throw new Error('Player cannot afford their Core offer')
  }

  if (aCards.length > 0) {
    const aCardIds = aCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_b_id} WHERE id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${aCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }
  if (bCards.length > 0) {
    const bCardIds = bCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_a_id} WHERE id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${bCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }

  const allCardIds = items.map(c => c.card_id)
  if (allCardIds.length > 0) {
    await tx`DELETE FROM cc_trade_pile WHERE card_id = ANY(${allCardIds})`
  }

  if (trade.player_a_core > 0) {
    await grantEmber(tx, trade.player_a_id, 'cc_trade', -trade.player_a_core, `Match Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_b_id, 'cc_trade', trade.player_a_core, `Match Trade #${tradeId}: received Core`, tradeId)
  }
  if (trade.player_b_core > 0) {
    await grantEmber(tx, trade.player_b_id, 'cc_trade', -trade.player_b_core, `Match Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_a_id, 'cc_trade', trade.player_b_core, `Match Trade #${tradeId}: received Core`, tradeId)
  }

  await tx`
    UPDATE cc_trades
    SET status = 'completed', offer_status = 'accepted', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${tradeId}
  `

  return { status: 'completed', trade }
}

export async function offerCancel(sql, userId, tradeId) {
  const [trade] = await sql`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND mode = 'match' AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  await sql`UPDATE cc_trades SET status = 'cancelled', updated_at = NOW() WHERE id = ${tradeId}`
}

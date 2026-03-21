// Tradematch — Tinder-style card trading matchmaker
// Discovery layer: trade pile, swipe feed, match detection, likes

export const TRADEMATCH_RULES = {
  min_trade_pile: 20,
  max_outgoing_matches: 5,
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
           c.card_data, c.def_id
    FROM cc_trade_pile tp
    JOIN cc_cards c ON tp.card_id = c.id
    WHERE tp.user_id = ${userId}
    ORDER BY tp.created_at DESC
  `
}

export async function addToTradePile(sql, userId, cardId) {
  // Verify ownership
  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check not in Starting 5
  const [inLineup] = await sql`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${userId}
    LIMIT 1
  `
  if (inLineup) throw new Error('Card is in your Starting 5 lineup')

  // Check not slotted as S5 consumable
  const [inS5] = await sql`SELECT user_id FROM cc_starting_five_state WHERE consumable_card_id = ${cardId}`
  if (inS5) throw new Error('Card is slotted in Starting 5')

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
    active_match_partners AS (
      SELECT CASE WHEN player_a_id = ${userId} THEN player_b_id ELSE player_a_id END AS partner_id
      FROM cc_trades
      WHERE mode = 'match' AND status = 'active'
        AND (player_a_id = ${userId} OR player_b_id = ${userId})
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
    LEFT JOIN active_match_partners amp ON tp.user_id = amp.partner_id
    LEFT JOIN boost_users bu ON tp.user_id = bu.user_id
    LEFT JOIN my_gods mg ON c.god_id = mg.god_id AND c.rarity = mg.rarity
    WHERE tp.user_id != ${userId}
      AND sw.id IS NULL
      AND amp.partner_id IS NULL
    ORDER BY has_boost DESC, is_novel DESC, tp.created_at DESC, random()
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
    SELECT t.*,
           u.discord_username AS partner_name, u.discord_avatar AS partner_avatar, u.discord_id AS partner_discord_id
    FROM cc_trades t
    JOIN users u ON u.id = CASE WHEN t.player_a_id = ${userId} THEN t.player_b_id ELSE t.player_a_id END
    WHERE (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
      AND t.mode = 'match'
      AND t.status = 'active'
    ORDER BY t.created_at DESC
  `
}

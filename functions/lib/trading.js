// Card Clash Trading — direct player-to-player card + Core swaps
import { grantEmber, ensureEmberBalance } from './ember.js'

export const TRADE_RULES = {
  max_cards_per_side: 10,
  max_packs_per_side: 5,
  expiry_minutes: 2,
}

// Check if a card is locked in an active/waiting trade
export async function isCardInTrade(sql, cardId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  return !!row
}

// Check if a pack is locked in an active/waiting trade
export async function isPackInTrade(sql, packInventoryId) {
  const [row] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${packInventoryId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  return !!row
}

// Expire stale trades (called on poll and on Vault load)
export async function expireStale(sql) {
  const mins = TRADE_RULES.expiry_minutes
  await sql`
    UPDATE cc_trades
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('waiting', 'active')
      AND last_polled_at < NOW() - make_interval(mins => ${mins})
  `
}

export async function createTrade(sql, userId, targetUserId) {
  if (userId === targetUserId) throw new Error('Cannot trade with yourself')

  // Check neither user has an active/waiting trade
  const [existing] = await sql`
    SELECT id FROM cc_trades
    WHERE status IN ('waiting', 'active')
      AND (player_a_id = ${userId} OR player_b_id = ${userId}
           OR player_a_id = ${targetUserId} OR player_b_id = ${targetUserId})
    LIMIT 1
  `
  if (existing) throw new Error('You or the target user already has an active trade')

  // Verify target user exists
  const [target] = await sql`SELECT id FROM users WHERE id = ${targetUserId}`
  if (!target) throw new Error('User not found')

  let trade
  try {
    ;[trade] = await sql`
      INSERT INTO cc_trades (player_a_id, player_b_id)
      VALUES (${userId}, ${targetUserId})
      RETURNING *
    `
  } catch (e) {
    if (e.code === '23505') throw new Error('You or the target user already has an active trade')
    throw e
  }
  return trade
}

export async function joinTrade(sql, userId, tradeId) {
  const [trade] = await sql`
    UPDATE cc_trades
    SET status = 'active', updated_at = NOW(), last_polled_at = NOW()
    WHERE id = ${tradeId} AND player_b_id = ${userId} AND status = 'waiting'
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or already started')
  return trade
}

export async function cancelTrade(sql, userId, tradeId) {
  const [trade] = await sql`
    UPDATE cc_trades
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${tradeId}
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
      AND status IN ('waiting', 'active')
    RETURNING *
  `
  if (!trade) throw new Error('Trade not found or already closed')
  return trade
}

export async function addCard(tx, userId, tradeId, cardId) {
  // Verify trade is active and user is a participant
  const [trade] = await tx`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  // Lock card row, verify ownership
  const [card] = await tx`
    SELECT id, owner_id FROM cc_cards WHERE id = ${cardId} FOR UPDATE
  `
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check card not in another active trade
  const [locked] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.id != ${tradeId}
    LIMIT 1
  `
  if (locked) throw new Error('Card is locked in another trade')

  // Check card not listed on marketplace
  const [listed] = await tx`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
    LIMIT 1
  `
  if (listed) throw new Error('Card is listed on the marketplace')

  // Check card not in Starting 5
  const [inLineup] = await tx`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${userId}
    LIMIT 1
  `
  if (inLineup) throw new Error('Card is in your Starting 5 lineup — remove it first')

  // Check card not slotted as Starting 5 consumable
  const [inS5Consumable] = await tx`
    SELECT user_id FROM cc_starting_five_state
    WHERE consumable_card_id = ${cardId}
  `
  if (inS5Consumable) throw new Error('Card is slotted in Starting 5 — replace it first')

  // Check card not in binder
  const [inBinder] = await tx`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (inBinder) throw new Error('Card is in your binder — remove it first')

  // Check max cards per side
  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId} AND item_type = 'card'
  `
  if (count >= TRADE_RULES.max_cards_per_side) {
    throw new Error(`Maximum ${TRADE_RULES.max_cards_per_side} cards per side`)
  }

  await tx`
    INSERT INTO cc_trade_cards (trade_id, card_id, offered_by)
    VALUES (${tradeId}, ${cardId}, ${userId})
  `

  // Reset ready flags
  await tx`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId}
  `
}

export async function addPack(tx, userId, tradeId, packInventoryId) {
  // Verify trade is active and user is a participant
  const [trade] = await tx`
    SELECT * FROM cc_trades
    WHERE id = ${tradeId} AND status = 'active'
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
    FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  // Verify pack ownership
  const [pack] = await tx`
    SELECT id, user_id FROM cc_pack_inventory WHERE id = ${packInventoryId}
  `
  if (!pack) throw new Error('Pack not found')
  if (pack.user_id !== userId) throw new Error('You do not own this pack')

  // Check pack not in another active trade
  const [locked] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${packInventoryId} AND t.status IN ('waiting', 'active') AND t.id != ${tradeId}
    LIMIT 1
  `
  if (locked) throw new Error('Pack is locked in another trade')

  // Check pack not listed on marketplace
  const [listed] = await tx`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${packInventoryId} AND status = 'active'
    LIMIT 1
  `
  if (listed) throw new Error('Pack is listed on the marketplace')

  // Check max packs per side
  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND offered_by = ${userId} AND item_type = 'pack'
  `
  if (count >= TRADE_RULES.max_packs_per_side) {
    throw new Error(`Maximum ${TRADE_RULES.max_packs_per_side} packs per side`)
  }

  await tx`
    INSERT INTO cc_trade_cards (trade_id, pack_inventory_id, offered_by, item_type)
    VALUES (${tradeId}, ${packInventoryId}, ${userId}, 'pack')
  `

  // Reset ready flags
  await tx`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId}
  `
}

export async function removeCard(sql, userId, tradeId, cardId) {
  const [removed] = await sql`
    DELETE FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND card_id = ${cardId} AND offered_by = ${userId}
    RETURNING id
  `
  if (!removed) throw new Error('Card not found in your trade offer')

  await sql`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
  `
}

export async function removePack(sql, userId, tradeId, packInventoryId) {
  const [removed] = await sql`
    DELETE FROM cc_trade_cards
    WHERE trade_id = ${tradeId} AND pack_inventory_id = ${packInventoryId} AND offered_by = ${userId}
    RETURNING id
  `
  if (!removed) throw new Error('Pack not found in your trade offer')

  await sql`
    UPDATE cc_trades
    SET player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
    WHERE id = ${tradeId} AND status = 'active'
  `
}

export async function setCore(sql, userId, tradeId, amount) {
  if (amount < 0) throw new Error('Core amount cannot be negative')
  if (amount > 10000) throw new Error('Core amount cannot exceed 10,000')

  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId} AND status = 'active'`
  if (!trade) throw new Error('Trade not found or not active')
  if (trade.player_a_id !== userId && trade.player_b_id !== userId) throw new Error('You are not in this trade')

  if (trade.player_a_id === userId) {
    await sql`
      UPDATE cc_trades SET player_a_core = ${amount},
        player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
      WHERE id = ${tradeId}
    `
  } else {
    await sql`
      UPDATE cc_trades SET player_b_core = ${amount},
        player_a_ready = false, player_b_ready = false,
        player_a_confirmed = false, player_b_confirmed = false,
        updated_at = NOW()
      WHERE id = ${tradeId}
    `
  }
}

export async function setReady(sql, userId, tradeId) {
  const [trade] = await sql`SELECT player_a_id, player_b_id FROM cc_trades WHERE id = ${tradeId} AND status = 'active'`
  if (!trade) throw new Error('Trade not found or not active')
  if (trade.player_a_id !== userId && trade.player_b_id !== userId) throw new Error('You are not in this trade')

  if (trade.player_a_id === userId) {
    await sql`UPDATE cc_trades SET player_a_ready = true, updated_at = NOW() WHERE id = ${tradeId}`
  } else {
    await sql`UPDATE cc_trades SET player_b_ready = true, updated_at = NOW() WHERE id = ${tradeId}`
  }
}

export async function confirmTrade(tx, userId, tradeId) {
  // Lock trade row
  const [trade] = await tx`
    SELECT * FROM cc_trades WHERE id = ${tradeId} AND status = 'active' FOR UPDATE
  `
  if (!trade) throw new Error('Trade not found or not active')

  const isA = trade.player_a_id === userId
  const isB = trade.player_b_id === userId
  if (!isA && !isB) throw new Error('You are not in this trade')

  // Both must be ready
  if (!trade.player_a_ready || !trade.player_b_ready) {
    throw new Error('Both players must be ready before confirming')
  }

  // Set this player's confirmed flag
  if (isA && !trade.player_a_confirmed) {
    await tx`UPDATE cc_trades SET player_a_confirmed = true, updated_at = NOW() WHERE id = ${tradeId}`
    trade.player_a_confirmed = true
  } else if (isB && !trade.player_b_confirmed) {
    await tx`UPDATE cc_trades SET player_b_confirmed = true, updated_at = NOW() WHERE id = ${tradeId}`
    trade.player_b_confirmed = true
  }

  // If only one confirmed so far, return — waiting for the other
  if (!trade.player_a_confirmed || !trade.player_b_confirmed) {
    return { status: 'waiting_for_confirm', trade }
  }

  // ═══ BOTH CONFIRMED — EXECUTE SWAP ═══

  // Get all trade items
  const items = await tx`SELECT * FROM cc_trade_cards WHERE trade_id = ${tradeId}`
  const aItems = items.filter(c => c.offered_by === trade.player_a_id)
  const bItems = items.filter(c => c.offered_by === trade.player_b_id)
  const aCards = aItems.filter(c => c.item_type === 'card')
  const bCards = bItems.filter(c => c.item_type === 'card')
  const aPacks = aItems.filter(c => c.item_type === 'pack')
  const bPacks = bItems.filter(c => c.item_type === 'pack')

  // Must have at least something to trade
  if (aItems.length === 0 && bItems.length === 0 && trade.player_a_core === 0 && trade.player_b_core === 0) {
    throw new Error('Trade is empty — add cards, packs, or Core')
  }

  // Verify card ownership still valid
  for (const tc of [...aCards, ...bCards]) {
    const [card] = await tx`SELECT owner_id FROM cc_cards WHERE id = ${tc.card_id} FOR UPDATE`
    if (!card || card.owner_id !== tc.offered_by) {
      throw new Error('A card in the trade is no longer owned by the trader')
    }
  }

  // Verify pack ownership still valid
  for (const tp of [...aPacks, ...bPacks]) {
    const [pack] = await tx`SELECT user_id FROM cc_pack_inventory WHERE id = ${tp.pack_inventory_id} FOR UPDATE`
    if (!pack || pack.user_id !== tp.offered_by) {
      throw new Error('A pack in the trade is no longer owned by the trader')
    }
  }

  // Lock ember balances, verify Core affordability
  if (trade.player_a_core > 0) {
    await ensureEmberBalance(tx, trade.player_a_id)
    const [balA] = await tx`
      SELECT balance FROM ember_balances WHERE user_id = ${trade.player_a_id} FOR UPDATE
    `
    if (!balA || balA.balance < trade.player_a_core) {
      throw new Error('You cannot afford your Core offer')
    }
  }
  if (trade.player_b_core > 0) {
    await ensureEmberBalance(tx, trade.player_b_id)
    const [balB] = await tx`
      SELECT balance FROM ember_balances WHERE user_id = ${trade.player_b_id} FOR UPDATE
    `
    if (!balB || balB.balance < trade.player_b_core) {
      throw new Error('Trade partner cannot afford their Core offer')
    }
  }

  // Transfer cards: A's cards → B, B's cards → A
  if (aCards.length > 0) {
    const aCardIds = aCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_b_id} WHERE id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${aCardIds})`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${aCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${aCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }
  if (bCards.length > 0) {
    const bCardIds = bCards.map(c => c.card_id)
    await tx`UPDATE cc_cards SET owner_id = ${trade.player_a_id} WHERE id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ANY(${bCardIds})`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ANY(${bCardIds})`
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ANY(${bCardIds}) AND status IN ('pending', 'awaiting_approval')`
  }

  // Transfer packs: A's packs → B, B's packs → A
  for (const tp of aPacks) {
    await tx`UPDATE cc_pack_inventory SET user_id = ${trade.player_b_id} WHERE id = ${tp.pack_inventory_id}`
  }
  for (const tp of bPacks) {
    await tx`UPDATE cc_pack_inventory SET user_id = ${trade.player_a_id} WHERE id = ${tp.pack_inventory_id}`
  }

  // Transfer Core
  if (trade.player_a_core > 0) {
    await grantEmber(tx, trade.player_a_id, 'cc_trade', -trade.player_a_core, `Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_b_id, 'cc_trade', trade.player_a_core, `Trade #${tradeId}: received Core`, tradeId)
  }
  if (trade.player_b_core > 0) {
    await grantEmber(tx, trade.player_b_id, 'cc_trade', -trade.player_b_core, `Trade #${tradeId}: sent Core`, tradeId)
    await grantEmber(tx, trade.player_a_id, 'cc_trade', trade.player_b_core, `Trade #${tradeId}: received Core`, tradeId)
  }

  // Mark trade completed
  const [completed] = await tx`
    UPDATE cc_trades
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${tradeId}
    RETURNING *
  `

  return {
    status: 'completed',
    trade: completed,
    cardsSwapped: { aToB: aCards.length, bToA: bCards.length },
    packsSwapped: { aToB: aPacks.length, bToA: bPacks.length },
    coreSwapped: { aToB: trade.player_a_core, bToA: trade.player_b_core },
  }
}

export async function pollTrade(sql, userId, tradeId) {
  // Update heartbeat
  await sql`
    UPDATE cc_trades SET last_polled_at = NOW()
    WHERE id = ${tradeId}
      AND (player_a_id = ${userId} OR player_b_id = ${userId})
      AND status IN ('waiting', 'active')
  `

  // Check for expiry
  await expireStale(sql)

  // Get trade state
  const [trade] = await sql`
    SELECT t.*,
           ua.discord_username AS player_a_name, ua.discord_avatar AS player_a_avatar, ua.discord_id AS player_a_discord_id,
           ub.discord_username AS player_b_name, ub.discord_avatar AS player_b_avatar, ub.discord_id AS player_b_discord_id
    FROM cc_trades t
    JOIN users ua ON t.player_a_id = ua.id
    JOIN users ub ON t.player_b_id = ub.id
    WHERE t.id = ${tradeId}
      AND (t.player_a_id = ${userId} OR t.player_b_id = ${userId})
  `
  if (!trade) throw new Error('Trade not found')

  // Get card items in trade
  const cardItems = await sql`
    SELECT tc.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type,
           c.image_url, c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url,
           d.best_god_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar
    FROM cc_trade_cards tc
    JOIN cc_cards c ON tc.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    WHERE tc.trade_id = ${tradeId} AND tc.item_type = 'card'
  `

  // Get pack items in trade
  const packItems = await sql`
    SELECT tc.id, tc.pack_inventory_id, tc.offered_by, tc.item_type,
           pi.pack_type_id, pt.name AS pack_name, pt.cards_per_pack, pt.category, pt.color AS pack_color
    FROM cc_trade_cards tc
    JOIN cc_pack_inventory pi ON tc.pack_inventory_id = pi.id
    JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    WHERE tc.trade_id = ${tradeId} AND tc.item_type = 'pack'
  `

  return { trade, cards: cardItems, packs: packItems }
}

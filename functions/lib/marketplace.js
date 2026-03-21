// Card Clash Marketplace — Core-only fee calculation & transaction logic
import { grantEmber } from './ember.js'

export const MARKET_RULES = {
  fee_percent: 0.02,        // 2% fee on each side
  min_fee_core: 1,
  max_card_listings_per_user: 15,
  max_pack_listings_per_user: 5,
}

export function calculateFee(price) {
  const raw = Math.floor(price * MARKET_RULES.fee_percent)
  return Math.max(raw, MARKET_RULES.min_fee_core)
}

export async function createListing(sql, userId, { cardId, packInventoryId, price }) {
  if (!price || price < 1) throw new Error('Price must be at least 1 Core')

  if (packInventoryId) {
    return createPackListing(sql, userId, packInventoryId, price)
  }

  // --- Card listing path (unchanged) ---

  // Verify card ownership
  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check card not locked in active trade
  const [tradeLock] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  if (tradeLock) throw new Error('Card is locked in an active trade')

  // Check card not slotted in Starting 5
  const [slotted] = await sql`
    SELECT role FROM cc_lineups
    WHERE user_id = ${userId} AND (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId})
  `
  if (slotted) {
    throw new Error('Card is in your Starting 5 lineup — remove it first')
  }

  // Check card not slotted as Starting 5 consumable
  const [inS5Consumable] = await sql`
    SELECT user_id FROM cc_starting_five_state
    WHERE consumable_card_id = ${cardId}
  `
  if (inS5Consumable) {
    throw new Error('Card is slotted in Starting 5 — replace it first')
  }

  // Check card not in binder
  const [bindered] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (bindered) throw new Error('Card is in your binder — remove it first')

  // Check card listing limit
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_market_listings
    WHERE seller_id = ${userId} AND status = 'active' AND item_type = 'card'
  `
  if (count >= MARKET_RULES.max_card_listings_per_user) {
    throw new Error(`Maximum ${MARKET_RULES.max_card_listings_per_user} active listings allowed`)
  }

  // Check card not already listed
  const [existing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
    LIMIT 1
  `
  if (existing) throw new Error('This card is already on the market!')

  const [listing] = await sql`
    INSERT INTO cc_market_listings (seller_id, card_id, price_type, core_price)
    VALUES (${userId}, ${cardId}, 'core', ${price})
    RETURNING *
  `

  // Auto-remove from trade pile when listed on marketplace
  await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`

  return listing
}

async function createPackListing(sql, userId, packInventoryId, price) {
  // Verify pack ownership
  const [pack] = await sql`
    SELECT id, user_id FROM cc_pack_inventory WHERE id = ${packInventoryId}
  `
  if (!pack) throw new Error('Pack not found')
  if (pack.user_id !== userId) throw new Error('You do not own this pack')

  // Check pack not in active trade
  const { isPackInTrade } = await import('./trading.js')
  if (await isPackInTrade(sql, packInventoryId)) {
    throw new Error('Pack is locked in an active trade')
  }

  // Check pack not already listed
  const [existing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${packInventoryId} AND status = 'active'
    LIMIT 1
  `
  if (existing) throw new Error('This pack is already on the market!')

  // Check pack listing limit (separate from card limit)
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_market_listings
    WHERE seller_id = ${userId} AND status = 'active' AND item_type = 'pack'
  `
  if (count >= MARKET_RULES.max_pack_listings_per_user) {
    throw new Error(`Maximum ${MARKET_RULES.max_pack_listings_per_user} active pack listings allowed`)
  }

  const [listing] = await sql`
    INSERT INTO cc_market_listings (seller_id, item_type, pack_inventory_id, price_type, core_price)
    VALUES (${userId}, 'pack', ${packInventoryId}, 'core', ${price})
    RETURNING *
  `
  return listing
}

export async function cancelListing(sql, userId, listingId) {
  const [listing] = await sql`
    UPDATE cc_market_listings
    SET status = 'cancelled'
    WHERE id = ${listingId} AND seller_id = ${userId} AND status = 'active'
    RETURNING *
  `
  if (!listing) throw new Error('Listing not found or already closed')
  return listing
}

export async function buyListing(tx, buyerId, listingId) {
  // Lock listing — no card JOIN, fetch listing independently
  const [listing] = await tx`
    SELECT * FROM cc_market_listings
    WHERE id = ${listingId} AND status = 'active'
    FOR UPDATE
  `
  if (!listing) throw new Error('Listing not found or already sold')
  if (listing.seller_id === buyerId) throw new Error('Cannot buy your own listing')

  const price = listing.core_price
  const fee = calculateFee(price)
  const totalCost = price + fee

  // Verify buyer can afford price + fee
  const [bal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${buyerId}`
  if (!bal || bal.balance < totalCost) throw new Error('Not enough Core')

  // Buyer pays price, seller receives price
  const itemLabel = listing.item_type === 'pack' ? 'pack' : `card #${listing.card_id}`
  await grantEmber(tx, buyerId, 'cc_market_buy', -price, `Marketplace: bought ${itemLabel}`)
  await grantEmber(tx, listing.seller_id, 'cc_market_sell', price, `Marketplace: sold ${itemLabel}`)

  // Buyer always pays fee; seller is exempt at minimum price (1 Core)
  await grantEmber(tx, buyerId, 'cc_market_fee', -fee, 'Marketplace fee (buyer)')
  if (price > 1) {
    await grantEmber(tx, listing.seller_id, 'cc_market_fee', -fee, 'Marketplace fee (seller)')
  }

  if (listing.item_type === 'pack') {
    // Verify pack still owned by seller before transfer
    const [pack] = await tx`SELECT user_id FROM cc_pack_inventory WHERE id = ${listing.pack_inventory_id} FOR UPDATE`
    if (!pack || pack.user_id !== listing.seller_id) throw new Error('Pack is no longer owned by the seller')

    // Transfer pack ownership
    await tx`UPDATE cc_pack_inventory SET user_id = ${buyerId} WHERE id = ${listing.pack_inventory_id}`
  } else {
    // Transfer card ownership
    await tx`UPDATE cc_cards SET owner_id = ${buyerId} WHERE id = ${listing.card_id}`

    // Remove card from Starting 5 lineup
    await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ${listing.card_id}`
    await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ${listing.card_id}`
    await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ${listing.card_id}`
    await tx`UPDATE cc_starting_five_state SET consumable_card_id = NULL WHERE consumable_card_id = ${listing.card_id}`

    // Remove card from binder
    await tx`DELETE FROM cc_binder_cards WHERE card_id = ${listing.card_id}`

    // Cancel open signature requests
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ${listing.card_id} AND status IN ('pending', 'awaiting_approval')`
  }

  // Mark listing sold
  const [updated] = await tx`
    UPDATE cc_market_listings
    SET status = 'sold', buyer_id = ${buyerId}, currency_used = 'core', sold_at = NOW()
    WHERE id = ${listingId}
    RETURNING *
  `

  return { listing: updated, price, fee }
}

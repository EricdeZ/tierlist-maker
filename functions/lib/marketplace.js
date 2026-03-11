// Card Clash Marketplace — Core-only fee calculation & transaction logic
import { grantEmber } from './ember.js'

export const MARKET_RULES = {
  fee_percent: 0.02,        // 2% fee on each side
  min_fee_core: 1,
  max_listings_per_user: 15,
}

export function calculateFee(price) {
  const raw = Math.floor(price * MARKET_RULES.fee_percent)
  return Math.max(raw, MARKET_RULES.min_fee_core)
}

export async function createListing(sql, userId, { cardId, price }) {
  // Verify card ownership
  const [card] = await sql`SELECT id, owner_id FROM cc_cards WHERE id = ${cardId}`
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== userId) throw new Error('You do not own this card')

  // Check card not locked in active trade
  const [tradeLock] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
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

  // Check card not in binder
  const [bindered] = await sql`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (bindered) throw new Error('Card is in your binder — remove it first')

  // Check listing limit
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM cc_market_listings
    WHERE seller_id = ${userId} AND status = 'active'
  `
  if (count >= MARKET_RULES.max_listings_per_user) {
    throw new Error(`Maximum ${MARKET_RULES.max_listings_per_user} active listings allowed`)
  }

  // Check card not already listed
  const [existing] = await sql`
    SELECT id FROM cc_market_listings
    WHERE card_id = ${cardId} AND status = 'active'
    LIMIT 1
  `
  if (existing) throw new Error('This card is already on the market!')

  if (!price || price < 1) throw new Error('Price must be at least 1 Core')

  const [listing] = await sql`
    INSERT INTO cc_market_listings (seller_id, card_id, price_type, core_price)
    VALUES (${userId}, ${cardId}, 'core', ${price})
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
  // Lock listing
  const [listing] = await tx`
    SELECT l.*, c.owner_id AS card_owner_id
    FROM cc_market_listings l
    JOIN cc_cards c ON l.card_id = c.id
    WHERE l.id = ${listingId} AND l.status = 'active'
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
  await grantEmber(tx, buyerId, 'cc_market_buy', -price, `Marketplace: bought card #${listing.card_id}`)
  await grantEmber(tx, listing.seller_id, 'cc_market_sell', price, `Marketplace: sold card #${listing.card_id}`)

  // Buyer always pays fee; seller is exempt at minimum price (1 Core)
  await grantEmber(tx, buyerId, 'cc_market_fee', -fee, 'Marketplace fee (buyer)')
  if (price > 1) {
    await grantEmber(tx, listing.seller_id, 'cc_market_fee', -fee, 'Marketplace fee (seller)')
  }

  // Transfer card ownership
  await tx`UPDATE cc_cards SET owner_id = ${buyerId} WHERE id = ${listing.card_id}`

  // Remove card from any Starting 5 lineup
  await tx`UPDATE cc_lineups SET card_id = NULL, slotted_at = NULL, god_card_id = NULL, item_card_id = NULL WHERE card_id = ${listing.card_id}`
  await tx`UPDATE cc_lineups SET god_card_id = NULL WHERE god_card_id = ${listing.card_id}`
  await tx`UPDATE cc_lineups SET item_card_id = NULL WHERE item_card_id = ${listing.card_id}`

  // Remove card from binder
  await tx`DELETE FROM cc_binder_cards WHERE card_id = ${listing.card_id}`

  // Mark listing sold
  const [updated] = await tx`
    UPDATE cc_market_listings
    SET status = 'sold', buyer_id = ${buyerId}, currency_used = 'core', sold_at = NOW()
    WHERE id = ${listingId}
    RETURNING *
  `

  return { listing: updated, price, fee }
}

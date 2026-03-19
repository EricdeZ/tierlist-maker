// Bounty Board — Core-escrowed wanted card requests
import { grantEmber, ensureEmberBalance } from './ember.js'

export const BOUNTY_RULES = {
  max_active: 3,
  min_reward: 1,
  max_reward: 10000,
  expiry_days: 14,
  cancel_fee_percent: 0.25,
  min_fee: 1,
}

export function calculateCancelFee(reward) {
  return Math.max(Math.floor(reward * BOUNTY_RULES.cancel_fee_percent), BOUNTY_RULES.min_fee)
}

export async function expireStale(tx) {
  const expired = await tx`
    UPDATE cc_bounties
    SET status = 'expired', cancelled_at = NOW(), updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW()
    RETURNING *
  `
  const refunds = []
  for (const b of expired) {
    await grantEmber(tx, b.poster_id, 'bounty_refund', b.core_reward,
      `Bounty expired: ${b.card_name} (${b.rarity})`, String(b.id))
    refunds.push({ bountyId: b.id, posterId: b.poster_id, fee: 0, refund: b.core_reward })
  }
  return refunds
}

export async function createBounty(tx, userId, { cardType, cardName, rarity, holoType, coreReward, targetGodId }) {
  if (!coreReward || coreReward < BOUNTY_RULES.min_reward || coreReward > BOUNTY_RULES.max_reward) {
    throw new Error(`Reward must be between ${BOUNTY_RULES.min_reward} and ${BOUNTY_RULES.max_reward} Core`)
  }

  const [{ count }] = await tx`
    SELECT COUNT(*)::int AS count FROM cc_bounties
    WHERE poster_id = ${userId} AND status = 'active'
  `
  if (count >= BOUNTY_RULES.max_active) {
    throw new Error(`Maximum ${BOUNTY_RULES.max_active} active bounties allowed`)
  }

  await ensureEmberBalance(tx, userId)
  const [bal] = await tx`
    SELECT balance FROM ember_balances
    WHERE user_id = ${userId}
    FOR UPDATE
  `
  if (!bal || bal.balance < coreReward) {
    throw new Error('Not enough Core')
  }

  await grantEmber(tx, userId, 'bounty_escrow', -coreReward,
    `Bounty posted: ${cardName} (${rarity})`)

  const [bounty] = await tx`
    INSERT INTO cc_bounties (poster_id, card_type, card_name, rarity, holo_type, core_reward, target_god_id, expires_at)
    VALUES (${userId}, ${cardType}, ${cardName}, ${rarity}, ${holoType}, ${coreReward}, ${targetGodId},
            NOW() + INTERVAL '14 days')
    RETURNING *
  `

  return bounty
}

export async function fulfillBounty(tx, fulfillerId, { bountyId, cardId }) {
  const [bounty] = await tx`
    SELECT * FROM cc_bounties
    WHERE id = ${bountyId} AND status = 'active'
    FOR UPDATE
  `
  if (!bounty) throw new Error('Bounty not found or already fulfilled')

  const [card] = await tx`
    SELECT id, owner_id, card_type, god_id, god_name, rarity, holo_type
    FROM cc_cards WHERE id = ${cardId}
    FOR UPDATE
  `
  if (!card) throw new Error('Card not found')
  if (card.owner_id !== fulfillerId) throw new Error('You do not own this card')

  if (card.card_type !== bounty.card_type) throw new Error('Card type does not match')
  if (bounty.target_god_id && card.god_id !== bounty.target_god_id) throw new Error('Card variant does not match')
  if (!bounty.target_god_id && card.god_name !== bounty.card_name) throw new Error('Card name does not match')
  if (card.rarity !== bounty.rarity) throw new Error('Card rarity does not match')
  // holo_type: 'none' = non-holo only, 'any_holo' = any holo, specific = exact match
  if (bounty.holo_type === 'none' && card.holo_type) throw new Error('Bounty requires a non-holo card')
  if (bounty.holo_type === 'any_holo' && !card.holo_type) throw new Error('Bounty requires a holo card')
  if (bounty.holo_type && bounty.holo_type !== 'none' && bounty.holo_type !== 'any_holo' && card.holo_type !== bounty.holo_type) throw new Error('Card holo type does not match')

  // Lock checks (same as marketplace)
  const [tradeLock] = await tx`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active')
    LIMIT 1
  `
  if (tradeLock) throw new Error('Card is locked in an active trade')

  const [slotted] = await tx`
    SELECT role FROM cc_lineups
    WHERE user_id = ${fulfillerId} AND (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId})
  `
  if (slotted) throw new Error('Card is in your Starting 5 lineup — remove it first')

  const [bindered] = await tx`
    SELECT id FROM cc_binder_cards WHERE card_id = ${cardId} LIMIT 1
  `
  if (bindered) throw new Error('Card is in your binder — remove it first')

  const [listed] = await tx`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active' LIMIT 1
  `
  if (listed) throw new Error('Card is listed on the marketplace — cancel listing first')

  await tx`UPDATE cc_cards SET owner_id = ${bounty.poster_id} WHERE id = ${cardId}`
  await tx`DELETE FROM cc_signature_requests WHERE card_id = ${cardId} AND status IN ('pending', 'awaiting_approval')`

  await grantEmber(tx, fulfillerId, 'bounty_reward', bounty.core_reward,
    `Bounty fulfilled: ${bounty.card_name} (${bounty.rarity})`, String(bountyId))

  const [updated] = await tx`
    UPDATE cc_bounties
    SET status = 'completed', fulfilled_by = ${fulfillerId}, fulfilled_card_id = ${cardId},
        completed_at = NOW(), updated_at = NOW()
    WHERE id = ${bountyId}
    RETURNING *
  `

  return { bounty: updated, reward: bounty.core_reward }
}

export async function cancelBounty(tx, userId, bountyId) {
  const [bounty] = await tx`
    SELECT * FROM cc_bounties
    WHERE id = ${bountyId} AND poster_id = ${userId} AND status = 'active'
    FOR UPDATE
  `
  if (!bounty) throw new Error('Bounty not found or already closed')

  const fee = calculateCancelFee(bounty.core_reward)
  const refund = bounty.core_reward - fee

  if (refund > 0) {
    await grantEmber(tx, userId, 'bounty_refund', refund,
      `Bounty cancelled: ${bounty.card_name} (${bounty.rarity})`, String(bountyId))
  }

  const [updated] = await tx`
    UPDATE cc_bounties
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = ${bountyId}
    RETURNING *
  `

  return { bounty: updated, fee, refund }
}

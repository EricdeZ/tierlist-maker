// Card Clash API — action-based endpoint
// GET: load state, definition overrides, shared card | POST: open-pack

import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'
import { jwtVerify } from 'jose'
import { ensureStats, openPack, generateGiftPack, grantStarterPacks, rollHoloEffect, rollHoloType } from '../lib/vault.js'
import { computePlayerStats } from '../lib/vault-defs.js'
import { getActivePassive, spendCharge, getGeneratedCards, claimGeneratedCard, toggleUniqueHunter, setHoloChoice, pickCardToRemove, checkSwapCooldown } from '../lib/passives.js'
import { ensureEmberBalance, grantEmber } from '../lib/ember.js'
import { pushChallengeProgress, getVaultStats } from '../lib/challenges.js'
import { tick, collectIncome, slotCard, unslotCard, unslotAttachment, useConsumable as applyConsumable, getBuffTotals, checkSynergy, getCardContribution, getAttachmentBonusInfo, calculateLineupOutput, S5_ALLSTAR_MODIFIER, TEAM_SYNERGY_BONUS, CONSUMABLE_DAILY_CAP, isRoleMismatch } from '../lib/starting-five.js'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET)

async function maybePushChallenges(sql, userId) {
    try {
        const [claimed] = await sql`
            UPDATE cc_stats
            SET last_challenge_push = NOW()
            WHERE user_id = ${userId}
              AND (last_challenge_push IS NULL OR last_challenge_push < NOW() - INTERVAL '10 seconds')
            RETURNING 1
        `
        if (!claimed) return
        const stats = await getVaultStats(sql, userId)
        return pushChallengeProgress(sql, userId, stats)
    } catch (err) {
        console.error('Challenge push failed:', err)
    }
}

const NEW_CARD_THRESHOLD = 1 // TODO: restore to 400

async function tagNewCards(sql, userId, formattedCards) {
  if (!formattedCards.length) return
  const newGodIds = formattedCards.map(c => c.godId)
  const [countRow] = await sql`SELECT COUNT(DISTINCT god_id)::int AS cnt FROM cc_cards WHERE owner_id = ${userId}`
  if (countRow.cnt < NEW_CARD_THRESHOLD) return
  // Check which of the new cards' god_ids the user already owned (excluding cards from this pack)
  const excludeIds = formattedCards.map(c => c.id)
  const existing = await sql`
    SELECT DISTINCT god_id FROM cc_cards
    WHERE owner_id = ${userId} AND god_id = ANY(${newGodIds})
    AND id != ALL(${excludeIds})
  `
  const existingSet = new Set(existing.map(r => r.god_id))
  for (const card of formattedCards) {
    if (!existingSet.has(card.godId)) card.isNew = true
  }
}

async function inlineBlueprintData(sql, formattedCards) {
  const bpCards = formattedCards.filter(c => c.blueprintId)
  if (bpCards.length === 0) return
  const bids = [...new Set(bpCards.map(c => c.blueprintId))]
  const blueprints = await sql`
    SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${bids})
  `
  const cache = {}
  for (const bp of blueprints) {
    const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
    cache[bp.id] = {
      cardData: td?.cardData || {},
      elements: td?.elements || [],
      border: td?.border || null,
      cardType: bp.card_type || 'custom',
    }
  }
  for (const card of bpCards) {
    if (cache[card.blueprintId]) {
      card._blueprintData = cache[card.blueprintId]
      const name = getBlueprintDisplayName(cache[card.blueprintId])
      if (name) card.godName = name
    }
  }
}

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  // Public endpoints (no auth required)
  if (event.httpMethod === 'GET' && action === 'shared-card') {
    return await handleSharedCard(sql, event.queryStringParameters)
  }
  if (event.httpMethod === 'GET' && action === 'binder-view') {
    return await handleBinderView(sql, event.queryStringParameters)
  }
  if (event.httpMethod === 'GET' && action === 'signed-unique-gallery') {
    return await handleSignedUniqueGallery(sql)
  }
  if (event.httpMethod === 'GET' && action === 'showcase-collection') {
    return await handleShowcaseCollection(sql, event.queryStringParameters)
  }

  const user = await requireAuth(event)
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
  }

  try {
    // Ban check — guards all authenticated actions
    const [ban] = await sql`SELECT 1 FROM cc_vault_bans WHERE user_id = ${user.id}`
    if (ban) return { statusCode: 200, headers, body: JSON.stringify({ vault_banned: true }) }

    // Account age check — Discord account must be 30+ days old to prevent alt farming
    const discordEpoch = 1420070400000n
    const discordCreatedAt = Number((BigInt(user.discord_id) >> 22n) + discordEpoch)
    const accountAgeMs = Date.now() - discordCreatedAt
    if (accountAgeMs < 30 * 24 * 60 * 60 * 1000) {
      const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - accountAgeMs) / (1000 * 60 * 60 * 24))
      return { statusCode: 200, headers, body: JSON.stringify({ account_too_new: true, days_left: daysLeft }) }
    }

    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'load': return await handleLoad(sql, user)
        case 'definition-overrides': return await handleDefinitionOverrides(sql)
        case 'collection-catalog': return await handleCollectionCatalog(sql)
        case 'collection-owned': return await handleCollectionOwned(sql, user)
        case 'collection-set': return await handleCollectionSet(sql, event.queryStringParameters)
        case 'collection-search': return await handleCollectionSearch(sql, event.queryStringParameters)
        case 'collection-collections': return await handleCollectionCollections(sql, user)
        case 'card-detail': return await handleCardDetail(sql, event.queryStringParameters)
        case 'gifts': return await handleLoadGifts(sql, user)
        case 'gift-leaderboard': return await handleGiftLeaderboard(sql, user)
        case 'pack-leaderboard': return await handlePackLeaderboard(sql, user, event.queryStringParameters)
        case 'search-users': return await handleSearchUsers(sql, user, event.queryStringParameters)
        case 'starting-five': return await handleStartingFive(sql, user)
        case 'starting-five-leaderboard': return await handleS5Leaderboard(sql, user)
        case 'binder': return await handleLoadBinder(sql, user)
        case 'pending-signatures': return await handlePendingSignatures(sql, user)
        case 'pending-approval-signatures': return await handlePendingApprovalSignatures(sql, user)
        case 'pending-reveal': return await handlePendingReveal(sql, user)
        case 'admin-redeem-codes': return await handleAdminRedeemCodes(sql, event)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'open-pack': return await handleOpenPack(sql, user, body, event)
        case 'open-inventory-pack': return await handleOpenInventoryPack(sql, user, body)
        case 'send-gift': return await handleSendGift(sql, user, body, event)
        case 'open-gift': return await handleOpenGift(sql, user, body)
        case 'buy-packs-to-inventory': return await handleBuyPacksToInventory(sql, user, body)
        case 'buy-gift-pack': return await handleBuyGiftPack(sql, user, body)
        case 'mark-gifts-seen': return await handleMarkGiftsSeen(sql, user)
        case 'mark-revealed': return await handleMarkRevealed(sql, user)
        case 'dismantle': return await handleDismantle(sql, user, body)
        case 'black-market-turn-in': return await handleBlackMarketTurnIn(sql, user, body)
        case 'black-market-claim-mythic': return await handleBlackMarketClaimMythic(sql, user, body)
        case 'black-market-debug-pending': { await requirePermission(event, 'permission_manage'); return await handleBlackMarketDebugPending(sql, user) }
        case 'slot-card': return await handleSlotCard(sql, user, body)
        case 'unslot-card': return await handleUnslotCard(sql, user, body)
        case 'unslot-attachment': return await handleUnslotAttachment(sql, user, body)
        case 'use-consumable': return await handleUseConsumable(sql, user, body)
        case 'collect-income': return await handleCollectIncome(sql, user)
        case 'binder-save': return await handleBinderSave(sql, user, body)
        case 'binder-slot': return await handleBinderSlot(sql, user, body)
        case 'binder-unslot': return await handleBinderUnslot(sql, user, body)
        case 'binder-generate-share': return await handleBinderGenerateShare(sql, user, event)
        case 'request-signature': return await handleRequestSignature(sql, user, body)
        case 'change-holo-type': return await handleChangeHoloType(sql, user, body)
        case 'decline-signature': return await handleDeclineSignature(sql, user, body)
        case 'approve-signature': return await handleApproveSignature(sql, user, body)
        case 'reject-signature': return await handleRejectSignature(sql, user, body)
        case 'direct-sign': return await handleDirectSign(sql, user, body)
        case 'redeem-code': return await handleRedeemCode(sql, user, body)
        case 'create-redeem-code': return await handleCreateRedeemCode(sql, event, body)
        case 'toggle-redeem-code': return await handleToggleRedeemCode(sql, event, body)
        case 'send-promo-gift': return await handleSendPromoGift(sql, user, body, event)
        case 'claim-promo-gift': return await handleClaimPromoGift(sql, user, body)
        case 'reroll-card': return await handleRerollCard(sql, user, body)
        case 'reroll-pack': return await handleRerollPack(sql, user, body)
        case 'claim-generated-card': return await handleClaimGeneratedCard(sql, user, body)
        case 'toggle-unique-hunter': return await handleToggleUniqueHunter(sql, user, body)
        case 'set-holo-choice': return await handleSetHoloChoice(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('vault error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load state ═══
async function handleLoad(sql, user) {
  // Ensure stats + ember balance rows exist in a single CTE
  await sql`
    WITH s AS (INSERT INTO cc_stats (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING),
         e AS (INSERT INTO ember_balances (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING)
    SELECT 1
  `
  await grantStarterPacks(sql, user.id)

  const [collection, stats, ember, packTypes, salePacks, tradeCount, matchTradeCount, inventory, _expired, lastVend, lockedCards, lockedPacks, pendingSignatures, rotationPacks, promoGifts] = await Promise.all([
    sql`SELECT c.*, d.best_god_name, d.team_id, d.player_id AS def_player_id,
             pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
             COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
             sp.name AS passive_name
         FROM cc_cards c
         LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
         LEFT JOIN LATERAL (
           SELECT u.id, u.discord_id, u.discord_avatar
           FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
         ) pu ON true
         LEFT JOIN user_preferences pup ON pup.user_id = pu.id
         LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
         WHERE c.owner_id = ${user.id} ORDER BY c.created_at DESC`,
    sql`SELECT * FROM cc_stats WHERE user_id = ${user.id}`,
    sql`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`,
    sql`
      SELECT pt.*, l.slug AS league_slug, l.name AS league_name,
             COALESCE(pt.color, l.color) AS resolved_color
      FROM cc_pack_types pt
      LEFT JOIN leagues l ON pt.league_id = l.id
      WHERE pt.enabled = true
         OR pt.id IN (SELECT pack_type_id FROM cc_pack_inventory WHERE user_id = ${user.id})
         OR ${user.role === 'admin'}
      ORDER BY pt.sort_order
    `,
    sql`
      SELECT s.*, pt.name AS base_name, pt.description AS base_description,
             pt.cards_per_pack, pt.category, pt.league_id,
             COALESCE(pt.color, l.color) AS resolved_color
      FROM cc_pack_sales s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      LEFT JOIN leagues l ON pt.league_id = l.id
      WHERE s.active = true
        AND (s.starts_at IS NULL OR s.starts_at <= NOW())
        AND (s.ends_at IS NULL OR s.ends_at > NOW())
      ORDER BY s.sort_order
    `,
    sql`
      SELECT COUNT(*)::int AS count FROM cc_trades
      WHERE ((player_b_id = ${user.id} AND status = 'waiting')
         OR ((player_a_id = ${user.id} OR player_b_id = ${user.id}) AND status = 'active'))
        AND mode = 'direct'
    `,
    sql`
      SELECT COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE offer_status = 'pending' AND offer_by != ${user.id})::int AS pending_count,
             COUNT(*) FILTER (WHERE offer_status = 'negotiating' AND offer_by IS NULL)::int AS new_count
      FROM cc_trades
      WHERE (player_a_id = ${user.id} OR player_b_id = ${user.id})
        AND mode = 'match' AND status = 'active'
    `,
    sql`
      SELECT i.id, i.pack_type_id, i.source, i.created_at, pt.name
      FROM cc_pack_inventory i
      JOIN cc_pack_types pt ON i.pack_type_id = pt.id
      WHERE i.user_id = ${user.id}
      ORDER BY i.created_at
    `,
    sql`
      UPDATE cc_trades SET status = 'expired', updated_at = NOW()
      WHERE (status IN ('waiting', 'active') AND mode = 'direct'
             AND last_polled_at < NOW() - make_interval(mins => 2))
         OR (status = 'active' AND mode = 'match'
             AND created_at < NOW() - interval '24 hours')
    `,
    sql`
      SELECT created_at FROM ember_transactions
      WHERE user_id = ${user.id} AND type = 'cc_pack' AND amount <= 0
      ORDER BY created_at DESC LIMIT 1
    `,
    // Locked cards: market listings + active trades (merged)
    sql`
      SELECT card_id, 'market' AS source FROM cc_market_listings WHERE seller_id = ${user.id} AND status = 'active' AND card_id IS NOT NULL
      UNION ALL
      SELECT tc.card_id, 'trade' FROM cc_trade_cards tc
      JOIN cc_trades t ON tc.trade_id = t.id
      WHERE tc.offered_by = ${user.id} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' AND tc.card_id IS NOT NULL
    `,
    // Locked packs: market listings + active trades (merged)
    sql`
      SELECT pack_inventory_id FROM cc_market_listings WHERE seller_id = ${user.id} AND status = 'active' AND item_type = 'pack'
      UNION ALL
      SELECT tc.pack_inventory_id FROM cc_trade_cards tc
      JOIN cc_trades t ON tc.trade_id = t.id
      WHERE tc.offered_by = ${user.id} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' AND tc.item_type = 'pack'
    `,
    // Pending signatures: own requests + approval requests (merged via CTE)
    sql`
      WITH signer AS (
        SELECT COUNT(*)::int AS count FROM cc_signature_requests
        WHERE signer_player_id = ${user.linked_player_id || 0} AND status = 'pending'
      ),
      approver AS (
        SELECT COUNT(*)::int AS count FROM cc_signature_requests sr
        JOIN cc_cards c ON sr.card_id = c.id
        WHERE c.owner_id = ${user.id} AND sr.status = 'awaiting_approval'
      )
      SELECT signer.count AS signer_count, approver.count AS approver_count
      FROM signer, approver
    `,
    sql`
      SELECT pack_type_id FROM cc_pack_rotation_schedule
      WHERE date = (SELECT MAX(date) FROM cc_pack_rotation_schedule WHERE date <= CURRENT_DATE)
    `,
    sql`
      SELECT id, card_type, rarity, card_config, message, blueprint_id, tradeable, created_at
      FROM cc_promo_gifts
      WHERE recipient_id = ${user.id} AND claimed = false
      ORDER BY created_at ASC
    `,
  ])

  // Build blueprint cache for blueprint-sourced cards
  const blueprintIds = [...new Set(
    collection.filter(c => c.blueprint_id)
      .map(c => c.blueprint_id)
  )]
  let blueprintCache = {}
  if (blueprintIds.length > 0) {
    const blueprints = await sql`
      SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${blueprintIds})
    `
    for (const bp of blueprints) {
      const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
      blueprintCache[bp.id] = {
        cardData: td?.cardData || {},
        elements: td?.elements || [],
        border: td?.border || null,
        cardType: bp.card_type || 'custom',
      }
    }
  }

  // Resolve blueprint display names onto collection cards
  for (const c of collection) {
    if (c.blueprint_id && blueprintCache[c.blueprint_id]) {
      const name = getBlueprintDisplayName(blueprintCache[c.blueprint_id])
      if (name) c.god_name = name
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collection: collection.map(formatCard),
      blueprintCache,
      stats: formatStats(stats[0]),
      emberBalance: ember[0]?.balance || 0,
      packTypes: packTypes.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        cost: p.cost,
        cards: p.cards_per_pack,
        guarantees: p.guarantees || [],
        category: p.category,
        leagueId: p.league_id,
        leagueSlug: p.league_slug,
        leagueName: p.league_name,
        color: p.resolved_color,
        sortOrder: p.sort_order,
        rotationOnly: p.rotation_only || false,
      })),
      rotationPacks: rotationPacks.map(r => r.pack_type_id),
      salePacks: salePacks.map(s => ({
        id: s.id,
        packTypeId: s.pack_type_id,
        name: s.name || s.base_name,
        description: s.description || s.base_description,
        price: s.price,
        stock: s.stock,
        initialStock: s.initial_stock,
        cards: s.cards_per_pack,
        category: s.category,
        leagueId: s.league_id,
        color: s.resolved_color,
        sortOrder: s.sort_order,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
      })),
      pendingTradeCount: tradeCount[0]?.count || 0,
      matchTradeCount: matchTradeCount[0]?.count || 0,
      matchTradePendingCount: (matchTradeCount[0]?.pending_count || 0) + (matchTradeCount[0]?.new_count || 0),
      pendingSignatureCount: pendingSignatures[0]?.signer_count || 0,
      pendingApprovalCount: pendingSignatures[0]?.approver_count || 0,
      inventory: inventory.map(i => ({
        id: i.id,
        packTypeId: i.pack_type_id,
        packName: i.name,
        source: i.source,
        createdAt: i.created_at,
      })),
      lockedCardIds: lockedCards.map(r => r.card_id),
      lockedPackIds: lockedPacks.map(r => r.pack_inventory_id),
      vendingCooldown: (() => {
        if (!lastVend[0]) return 0
        const elapsed = (Date.now() - new Date(lastVend[0].created_at).getTime()) / 1000
        return elapsed < VENDING_COOLDOWN_SECONDS ? Math.ceil(VENDING_COOLDOWN_SECONDS - elapsed) : 0
      })(),
      promoGifts: promoGifts.map(g => ({
        id: g.id,
        cardType: g.card_type,
        rarity: g.rarity,
        cardConfig: g.card_config,
        message: g.message,
        blueprintId: g.blueprint_id,
        tradeable: g.tradeable,
        createdAt: g.created_at,
      })),
    }),
  }
}

// ═══ POST: Open pack from inventory ═══
async function handleOpenInventoryPack(sql, user, body) {
  const { inventoryId } = body
  if (!inventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'inventoryId required' }) }

  // Verify ownership
  const [pack] = await sql`
    SELECT id, pack_type_id, user_id FROM cc_pack_inventory
    WHERE id = ${inventoryId} AND user_id = ${user.id}
  `
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack not found in inventory' }) }

  // Check not listed on marketplace
  const [marketLock] = await sql`
    SELECT id FROM cc_market_listings
    WHERE pack_inventory_id = ${inventoryId} AND status = 'active'
    LIMIT 1
  `
  if (marketLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack is listed on the market — cancel the listing first' }) }

  // Check not in active trade
  const [tradeLock] = await sql`
    SELECT tc.id FROM cc_trade_cards tc
    JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.pack_inventory_id = ${inventoryId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
    LIMIT 1
  `
  if (tradeLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack is in an active trade — cancel the trade first' }) }

  // Clean up any cancelled/expired listings referencing this pack before deleting
  await sql`DELETE FROM cc_market_listings WHERE pack_inventory_id = ${inventoryId} AND status != 'active'`

  // Clean up trade_cards references from completed/cancelled/expired trades
  await sql`
    DELETE FROM cc_trade_cards tc
    USING cc_trades t
    WHERE tc.trade_id = t.id
      AND tc.pack_inventory_id = ${inventoryId}
      AND t.status NOT IN ('waiting', 'active')
  `

  // Delete from inventory and open
  await sql`DELETE FROM cc_pack_inventory WHERE id = ${inventoryId}`

  const result = await openPack(sql, user.id, pack.pack_type_id, { skipPayment: true })
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })
  await inlineBlueprintData(sql, cards)
  await tagNewCards(sql, user.id, cards)

  maybePushChallenges(sql, user.id)

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: pack.pack_type_id,
    cards,
    packOpenId: result.packOpenId,
  }) }
}

// ═══ POST: Buy packs to inventory ═══
async function handleBuyPacksToInventory(sql, user, body) {
  const { packType, quantity } = body
  const qty = Math.floor(Number(quantity))
  if (!packType || !qty || qty < 1) return { statusCode: 400, headers, body: JSON.stringify({ error: 'packType and quantity (>= 1) required' }) }
  if (qty > 100) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 100 packs per purchase' }) }

  const [pack] = await sql`SELECT * FROM cc_pack_types WHERE id = ${packType} AND (enabled = true OR ${user.role === 'admin'})`
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack not found' }) }

  // Rotation-only packs can only be purchased when in the current rotation
  if (pack.rotation_only) {
    const [inRotation] = await sql`
      SELECT 1 FROM cc_pack_rotation_schedule
      WHERE date = (SELECT MAX(date) FROM cc_pack_rotation_schedule WHERE date <= CURRENT_DATE)
        AND pack_type_id = ${packType}
    `
    if (!inRotation) return { statusCode: 400, headers, body: JSON.stringify({ error: 'This pack is not currently in rotation' }) }
  }

  const totalCost = pack.cost * qty

  try {
    const result = await transaction(async (tx) => {
      if (totalCost > 0) {
        await ensureEmberBalance(tx, user.id)
        const [bal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${user.id} FOR UPDATE`
        if (!bal || bal.balance < totalCost) throw new Error('Not enough Cores')
        await grantEmber(tx, user.id, 'cc_pack', -totalCost, `Card Clash: ${qty}x ${pack.name} (inventory)`)
      }

      const inserted = await tx`
        INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
        SELECT ${user.id}, ${pack.id}, 'shop'
        FROM generate_series(1, ${qty})
        RETURNING id, pack_type_id, source, created_at
      `

      const [updatedBal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`

      return {
        ember: updatedBal?.balance ?? 0,
        inventory: inserted.map(i => ({ id: i.id, packTypeId: i.pack_type_id, source: i.source, createdAt: i.created_at })),
      }
    })

    return { statusCode: 200, headers, body: JSON.stringify(result) }
  } catch (err) {
    const msg = err.message
    if (msg === 'Not enough Cores') return { statusCode: 400, headers, body: JSON.stringify({ error: msg }) }
    throw err
  }
}

// ═══ POST: Open pack ═══
async function handleOpenPack(sql, user, body, event) {
  const { packType, saleId } = body

  // Sale purchase — atomic stock decrement + payment in transaction
  if (saleId) {
    return await handleSalePurchase(sql, user, saleId)
  }

  // Rotation-only packs can only be purchased when in the current rotation
  const [rotCheck] = await sql`SELECT rotation_only FROM cc_pack_types WHERE id = ${packType}`
  if (rotCheck?.rotation_only) {
    const [inRotation] = await sql`
      SELECT 1 FROM cc_pack_rotation_schedule
      WHERE date = (SELECT MAX(date) FROM cc_pack_rotation_schedule WHERE date <= CURRENT_DATE)
        AND pack_type_id = ${packType}
    `
    if (!inRotation) return { statusCode: 400, headers, body: JSON.stringify({ error: 'This pack is not currently in rotation' }) }
  }

  // Load active passive for odds modification
  const passive = await getActivePassive(sql, user.id)

  const isAdmin = user.role === 'admin'
  const result = await openPack(sql, user.id, packType, { passive, skipEnabledCheck: isAdmin })
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })
  await inlineBlueprintData(sql, cards)
  await tagNewCards(sql, user.id, cards)

  maybePushChallenges(sql, user.id)

  // Build reroll state if passive provides reroll charges
  let rerollState = null
  if (passive) {
    const cardRerollCharges = passive.passiveName === 'card_reroll' ? (passive.charges || 0) : 0
    const packRerollCharges = passive.passiveName === 'pack_reroll' ? (passive.charges || 0) : 0

    if (cardRerollCharges > 0 || packRerollCharges > 0) {
      const rarityIdx = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
      const staffRarityIdx = rarityIdx[passive.staffRarity] || 0

      const eligibleCardIndices = result.cards
        .map((c, i) => ({ i, rarity: c.rarity }))
        .filter(c => (rarityIdx[c.rarity] || 0) <= staffRarityIdx)
        .map(c => c.i)

      const [session] = await sql`
        INSERT INTO cc_pack_sessions (user_id, cards, odds_context, reroll_count)
        VALUES (${user.id}, ${JSON.stringify(result.cards)}::jsonb, ${JSON.stringify({})}::jsonb, 0)
        RETURNING id
      `

      rerollState = {
        sessionId: session.id,
        cardRerollCharges,
        packRerollCharges,
        eligibleCardIndices,
      }
    }
  }

  // Cleanup expired pack sessions (fire-and-forget)
  event.waitUntil(sql`DELETE FROM cc_pack_sessions WHERE expires_at < NOW()`)

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType,
    cards,
    packOpenId: result.packOpenId,
    rerollState,
  }) }
}

// ═══ POST: Reroll a single card in an open pack ═══
async function handleRerollCard(sql, user, body) {
  const { sessionId, cardIndex } = body

  const passive = await getActivePassive(sql, user.id)
  if (!passive || passive.passiveName !== 'card_reroll') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No card reroll passive active' }) }
  }

  const [session] = await sql`
    SELECT * FROM cc_pack_sessions
    WHERE id = ${sessionId} AND user_id = ${user.id} AND expires_at > NOW()
  `
  if (!session) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack session expired' }) }

  const cards = session.cards
  if (cardIndex < 0 || cardIndex >= cards.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid card index' }) }
  }

  // Promo gift cards cannot be rerolled
  if (cards[cardIndex].id) {
    const [check] = await sql`SELECT acquired_via FROM cc_cards WHERE id = ${cards[cardIndex].id}`
    if (check?.acquired_via === 'gift') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift cards cannot be rerolled' }) }
    }
  }

  const rarityIdx = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
  if ((rarityIdx[cards[cardIndex].rarity] || 0) > (rarityIdx[passive.staffRarity] || 0)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card rarity too high for reroll' }) }
  }

  const chargesRemaining = await spendCharge(sql, user.id, 'card_reroll', passive.staffRarity)

  const { createOddsContext } = await import('../lib/odds.js')
  const { applyPassiveToContext } = await import('../lib/passives.js')
  const { generateCardForReroll } = await import('../lib/vault.js')

  let ctx = createOddsContext()
  ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)

  const newCard = await generateCardForReroll(sql, user.id, cards[cardIndex].rarity, ctx)

  // Delete old card from cc_cards
  if (cards[cardIndex].id) {
    await sql`DELETE FROM cc_cards WHERE id = ${cards[cardIndex].id} AND owner_id = ${user.id}`
  }

  // Update session
  cards[cardIndex] = newCard
  await sql`UPDATE cc_pack_sessions SET cards = ${JSON.stringify(cards)}::jsonb WHERE id = ${sessionId}`

  const formatted = formatCard(newCard)
  return { statusCode: 200, headers, body: JSON.stringify({ newCard: formatted, chargesRemaining }) }
}

// ═══ POST: Reroll the entire pack ═══
async function handleRerollPack(sql, user, body) {
  const { sessionId } = body

  const passive = await getActivePassive(sql, user.id)
  if (!passive || passive.passiveName !== 'pack_reroll') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No pack reroll passive active' }) }
  }

  const [session] = await sql`
    SELECT * FROM cc_pack_sessions
    WHERE id = ${sessionId} AND user_id = ${user.id} AND expires_at > NOW()
  `
  if (!session) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack session expired' }) }

  // Spend charge only on first reroll of a pack
  let chargesRemaining = passive.charges
  if (session.reroll_count === 0) {
    chargesRemaining = await spendCharge(sql, user.id, 'pack_reroll', passive.staffRarity)
  }

  const oldCards = session.cards

  // Promo gift cards cannot be rerolled
  for (const c of oldCards) {
    if (c.acquired_via === 'gift') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift cards cannot be rerolled' }) }
    }
  }

  // Pick card to remove
  const removeIdx = pickCardToRemove(oldCards, passive.staffRarity, session.reroll_count)
  const remaining = oldCards.filter((_, i) => i !== removeIdx)

  // Delete ALL old cards from cc_cards
  for (const oldCard of oldCards) {
    if (oldCard.id) {
      await sql`DELETE FROM cc_cards WHERE id = ${oldCard.id} AND owner_id = ${user.id}`
    }
  }

  // Re-generate remaining cards with same rarities
  const { createOddsContext } = await import('../lib/odds.js')
  const { applyPassiveToContext } = await import('../lib/passives.js')
  const { generateCardForReroll } = await import('../lib/vault.js')

  let ctx = createOddsContext()
  ctx = applyPassiveToContext(ctx, passive.passiveName, passive.staffRarity, passive)

  const newCards = []
  for (const oldCard of remaining) {
    const newCard = await generateCardForReroll(sql, user.id, oldCard.rarity, ctx, { lockRarity: true })
    newCards.push(newCard)
  }

  // Update session
  const newRerollCount = session.reroll_count + 1
  await sql`
    UPDATE cc_pack_sessions
    SET cards = ${JSON.stringify(newCards)}::jsonb, reroll_count = ${newRerollCount}
    WHERE id = ${sessionId}
  `

  const formattedCards = newCards.map(c => formatCard(c))

  return { statusCode: 200, headers, body: JSON.stringify({
    cards: formattedCards,
    chargesRemaining,
  }) }
}

// ═══ POST: Claim a generated card from Card Generator ═══
async function handleClaimGeneratedCard(sql, user, body) {
  const { generatedCardId } = body
  const card = await claimGeneratedCard(sql, user.id, generatedCardId)
  return { statusCode: 200, headers, body: JSON.stringify({ card: formatCard(card) }) }
}

// ═══ POST: Toggle Unique Hunter on/off ═══
async function handleToggleUniqueHunter(sql, user, body) {
  const { enabled } = body
  await toggleUniqueHunter(sql, user.id, !!enabled)
  return { statusCode: 200, headers, body: JSON.stringify({ enabled: !!enabled }) }
}

// ═══ POST: Set Holo Boost choice ═══
async function handleSetHoloChoice(sql, user, body) {
  const { holoChoice } = body
  await setHoloChoice(sql, user.id, holoChoice)
  return { statusCode: 200, headers, body: JSON.stringify({ holoChoice }) }
}

// ═══ POST: Sale purchase — transactional stock + payment ═══
const VENDING_COOLDOWN_SECONDS = 28

async function handleSalePurchase(sql, user, saleId) {
  const result = await transaction(async (tx) => {
    // Lock user's ember balance row to serialize per-user vending purchases
    await tx`SELECT 1 FROM ember_balances WHERE user_id = ${user.id} FOR UPDATE`

    // Enforce per-user cooldown (inside transaction to prevent races)
    const [lastPurchase] = await tx`
      SELECT created_at FROM ember_transactions
      WHERE user_id = ${user.id} AND type = 'cc_pack' AND amount <= 0
      ORDER BY created_at DESC LIMIT 1
    `
    if (lastPurchase) {
      const elapsed = (Date.now() - new Date(lastPurchase.created_at).getTime()) / 1000
      if (elapsed < VENDING_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(VENDING_COOLDOWN_SECONDS - elapsed)
        throw Object.assign(new Error(`Vending machine cooling down — ${retryAfter}s`), { retryAfter, cooldown: true })
      }
    }

    // Lock the sale row and verify availability
    const [sale] = await tx`
      SELECT s.*, pt.id AS pack_type_id_ref
      FROM cc_pack_sales s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      WHERE s.id = ${saleId} AND s.active = true
        AND (s.starts_at IS NULL OR s.starts_at <= NOW())
        AND (s.ends_at IS NULL OR s.ends_at > NOW())
      FOR UPDATE
    `
    if (!sale) throw new Error('Sale not available')
    if (sale.stock <= 0) throw new Error('Sold out')

    const [updated] = await tx`
      UPDATE cc_pack_sales SET stock = stock - 1
      WHERE id = ${saleId} AND stock > 0
      RETURNING stock
    `
    if (!updated) throw new Error('Sold out')

    // Charge sale price (always record transaction for cooldown tracking)
    const [bal] = await tx`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`
    if (sale.price > 0) {
      if (!bal || bal.balance < sale.price) throw new Error('Not enough Ember')
    }
    await grantEmber(tx, user.id, 'cc_pack', -(sale.price || 0), `Card Clash: ${sale.name || 'Sale Pack'}`)

    const packResult = await openPack(tx, user.id, sale.pack_type_id, { skipPayment: true })
    return { ...packResult, stock: updated.stock }
  }).catch(err => {
    // Convert cooldown errors to 429 response
    if (err.cooldown) {
      return { _cooldown: true, retryAfter: err.retryAfter, message: err.message }
    }
    throw err
  })

  if (result._cooldown) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: result.message, retryAfter: result.retryAfter }) }
  }

  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })
  await inlineBlueprintData(sql, cards)
  await tagNewCards(sql, user.id, cards)

  maybePushChallenges(sql, user.id)

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: result.packType,
    cards,
    stock: result.stock,
    packOpenId: result.packOpenId,
  }) }
}

// ═══ GET: Shared player card (public — token-gated preview) ═══
async function handleSharedCard(sql, params) {
  const { token } = params || {}
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) }

  let payload
  try {
    const result = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    payload = result.payload
  } catch {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid or expired share link' }) }
  }

  const { playerSlug, holoEffect, rarity, holoType } = payload
  if (!playerSlug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token' }) }

  try {
    const [player] = await sql`
      SELECT p.id, p.name, p.slug,
             u.discord_id, u.discord_avatar,
             COALESCE(up.allow_discord_avatar, true) AS allow_discord_avatar,
             CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
      FROM players p
      LEFT JOIN LATERAL (
        SELECT lu.id, lu.discord_id, lu.discord_avatar
        FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
      ) u ON true
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE p.slug = ${playerSlug}
    `
    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player not found' }) }

    const [latestSeason] = await sql`
      SELECT lp.role, lp.team_id, t.name AS team_name, t.color AS team_color,
             s.name AS season_name, l.name AS league_name, d.name AS division_name
      FROM league_players lp
      JOIN seasons s ON lp.season_id = s.id
      JOIN divisions d ON s.division_id = d.id
      JOIN leagues l ON s.league_id = l.id
      LEFT JOIN teams t ON lp.team_id = t.id
      WHERE lp.player_id = ${player.id}
      ORDER BY s.is_active DESC, s.start_date DESC
      LIMIT 1
    `

    const games = await sql`
      SELECT pgs.kills, pgs.deaths, pgs.assists, pgs.damage, pgs.mitigated,
             pgs.god_played, pgs.team_side,
             g.winner_team_id,
             CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS player_team_id
      FROM player_game_stats pgs
      JOIN league_players lp ON pgs.league_player_id = lp.id
      JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
      JOIN matches m ON g.match_id = m.id
      WHERE lp.player_id = ${player.id}
      ORDER BY m.date DESC
    `

    let avatarUrl = null
    if (player.allow_discord_avatar && player.discord_id && player.discord_avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
    }

    let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
    const godMap = {}
    for (const g of games) {
      gamesPlayed++
      if (g.winner_team_id === g.player_team_id) wins++
      kills += parseInt(g.kills) || 0
      deaths += parseInt(g.deaths) || 0
      assists += parseInt(g.assists) || 0
      totalDamage += parseInt(g.damage) || 0
      totalMitigated += parseInt(g.mitigated) || 0
      if (g.god_played) {
        if (!godMap[g.god_played]) godMap[g.god_played] = { name: g.god_played, games: 0, wins: 0 }
        godMap[g.god_played].games++
        if (g.winner_team_id === g.player_team_id) godMap[g.god_played].wins++
      }
    }

    const gods = Object.values(godMap).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    const best = gods[0] || null
    let bestGod = null
    if (best) {
      const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      bestGod = {
        name: best.name,
        imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
        games: best.games,
        winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        holoEffect: holoEffect || 'gold',
        rarity: rarity || 'legendary',
        holoType: holoType || 'reverse',
        card: {
          playerName: player.name,
          teamName: latestSeason?.team_name || null,
          teamColor: latestSeason?.team_color || '#6366f1',
          seasonName: latestSeason?.season_name || '',
          leagueName: latestSeason?.league_name || '',
          divisionName: latestSeason?.division_name || '',
          role: (latestSeason?.role || 'ADC').toUpperCase(),
          avatarUrl,
          isConnected: player.is_claimed,
          stats: {
            gamesPlayed,
            wins,
            winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
            kda: deaths > 0 ? (kills + assists / 2) / deaths : kills + assists / 2,
            avgDamage: gamesPlayed > 0 ? totalDamage / gamesPlayed : 0,
            avgMitigated: gamesPlayed > 0 ? totalMitigated / gamesPlayed : 0,
            totalKills: kills,
            totalDeaths: deaths,
            totalAssists: assists,
          },
          bestGod,
        },
      }),
    }
  } catch (error) {
    console.error('shared-card error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) }
  }
}

// ═══ GET: Collection catalog (static — same for all users, cacheable) ═══
async function handleCollectionCatalog(sql) {
  const playerSetSummaries = await sql`
    SELECT
      d.league_slug, d.division_tier, d.division_slug, d.season_slug,
      s.name AS season_name, s.is_active,
      d.league_id,
      div.name AS division_name,
      COUNT(*)::int AS total,
      array_agg(d.id ORDER BY d.card_index) AS def_ids
    FROM cc_player_defs d
    JOIN seasons s ON d.season_id = s.id
    JOIN divisions div ON d.division_id = div.id
    GROUP BY d.league_slug, d.division_tier, d.division_slug, d.season_slug,
             s.name, s.is_active, d.league_id, div.name
    ORDER BY d.league_slug, d.division_tier, d.season_slug
  `

  const playerSets = playerSetSummaries.map(s => ({
    key: `${s.league_slug}-d${s.division_tier}-${s.season_slug}`,
    leagueSlug: s.league_slug,
    leagueId: s.league_id,
    divisionTier: s.division_tier,
    divisionSlug: s.division_slug,
    divisionName: s.division_name,
    seasonSlug: s.season_slug,
    seasonName: s.season_name,
    seasonActive: s.is_active,
    total: s.total,
    defIds: s.def_ids,
  }))

  return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ playerSets }) }
}

// ═══ GET: Collection owned (lightweight — only user's ownership data) ═══
async function handleCollectionOwned(sql, user) {
  const [gameCards, playerCards, recentRows] = await Promise.all([
    sql`
      SELECT card_type, god_id, array_agg(rarity) AS rarities
      FROM cc_cards
      WHERE owner_id = ${user.id} AND card_type != 'player'
      GROUP BY card_type, god_id
    `,
    sql`
      SELECT def_id, array_agg(rarity) AS rarities,
             array_agg(DISTINCT rarity) FILTER (WHERE is_first_edition) AS fe_rarities
      FROM cc_cards
      WHERE owner_id = ${user.id} AND card_type = 'player' AND def_id IS NOT NULL
      GROUP BY def_id
    `,
    sql`
      SELECT c.id, c.card_type, c.god_id, c.rarity, c.is_first_edition, c.def_id, c.created_at, c.signature_url,
             d.player_name, d.team_name, d.team_color, d.role, d.best_god_name,
             d.league_slug, d.division_tier, d.division_slug, d.season_slug, d.card_index,
             CASE
               WHEN COALESCE(up.allow_discord_avatar, true) AND u.discord_id IS NOT NULL AND u.discord_avatar IS NOT NULL
               THEN 'https://cdn.discordapp.com/avatars/' || u.discord_id || '/' || u.discord_avatar || '.webp?size=256'
               ELSE NULL
             END AS avatar_url,
             CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_connected
      FROM cc_cards c
      LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
      LEFT JOIN players p ON p.slug = d.player_slug
      LEFT JOIN LATERAL (
        SELECT lu.id, lu.discord_id, lu.discord_avatar
        FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
      ) u ON true
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE c.owner_id = ${user.id}
      ORDER BY c.created_at DESC
      LIMIT 8
    `,
  ])

  const gameMap = {}
  for (const c of gameCards) gameMap[`${c.card_type}:${c.god_id}`] = c.rarities

  const playerMap = {}
  const feMap = {}
  for (const c of playerCards) {
    playerMap[c.def_id] = c.rarities
    if (c.fe_rarities?.length) feMap[c.def_id] = c.fe_rarities
  }

  const recentPulls = recentRows.map(c => ({
    id: c.id,
    cardType: c.card_type,
    godId: c.god_id,
    rarity: c.rarity,
    isFirstEdition: c.is_first_edition,
    defId: c.def_id,
    createdAt: c.created_at,
    playerName: c.player_name,
    teamName: c.team_name,
    teamColor: c.team_color,
    role: c.role,
    bestGodName: c.best_god_name,
    avatarUrl: c.avatar_url,
    isConnected: c.is_connected,
    leagueSlug: c.league_slug,
    divisionTier: c.division_tier,
    divisionSlug: c.division_slug,
    seasonSlug: c.season_slug,
    cardIndex: c.card_index,
    signatureUrl: c.signature_url || null,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ gameCards: gameMap, playerCards: playerMap, firstEditions: feMap, recentPulls }) }
}

// ═══ GET: Collections the user owns cards from ═══
async function handleCollectionCollections(sql, user) {
  const ownedRows = await sql`
    SELECT blueprint_id, array_agg(rarity) AS rarities
    FROM cc_cards
    WHERE owner_id = ${user.id} AND blueprint_id IS NOT NULL
    GROUP BY blueprint_id
  `
  if (ownedRows.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const ownedBlueprintIds = ownedRows.map(r => r.blueprint_id)

  const collectionIds = await sql`
    SELECT DISTINCT collection_id FROM cc_collection_entries
    WHERE blueprint_id = ANY(${ownedBlueprintIds})
  `
  if (collectionIds.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ collections: [], owned: {} }) }
  }

  const cIds = collectionIds.map(r => r.collection_id)

  const [collections, entries] = await Promise.all([
    sql`
      SELECT id, name, description, cover_image_url
      FROM cc_collections
      WHERE id = ANY(${cIds}) AND status != 'archived'
    `,
    sql`
      SELECT ce.collection_id, ce.blueprint_id,
             bp.name, bp.card_type, bp.template_data
      FROM cc_collection_entries ce
      JOIN cc_card_blueprints bp ON bp.id = ce.blueprint_id
      WHERE ce.collection_id = ANY(${cIds})
      ORDER BY ce.id
    `,
  ])

  const collectionMap = new Map()
  for (const col of collections) {
    collectionMap.set(col.id, {
      id: col.id,
      name: col.name,
      description: col.description,
      coverImageUrl: col.cover_image_url,
      entries: [],
    })
  }

  for (const e of entries) {
    const col = collectionMap.get(e.collection_id)
    if (!col) continue
    col.entries.push({
      blueprintId: e.blueprint_id,
      name: e.name,
      cardType: e.card_type,
      templateData: e.template_data,
    })
  }

  const owned = {}
  for (const r of ownedRows) owned[r.blueprint_id] = r.rarities

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      collections: [...collectionMap.values()].filter(c => c.entries.length > 0),
      owned,
    }),
  }
}

// ═══ GET: Collection set defs (static — cacheable, no ownership) ═══
async function handleCollectionSet(sql, params) {
  const { setKey } = params || {}
  if (!setKey) return { statusCode: 400, headers, body: JSON.stringify({ error: 'setKey required' }) }

  const defs = await sql`
    SELECT d.id, d.card_index, d.player_name, d.player_slug, d.team_name, d.team_color,
           d.role, d.best_god_name,
           CASE
             WHEN COALESCE(up.allow_discord_avatar, true) AND u.discord_id IS NOT NULL AND u.discord_avatar IS NOT NULL
             THEN 'https://cdn.discordapp.com/avatars/' || u.discord_id || '/' || u.discord_avatar || '.webp?size=256'
             WHEN COALESCE(up.allow_discord_avatar, true) THEN d.avatar_url
             ELSE NULL
           END AS avatar_url,
           d.league_slug, d.division_tier, d.season_slug,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM cc_player_defs d
    LEFT JOIN players p ON p.slug = d.player_slug
    LEFT JOIN LATERAL (
      SELECT lu.id, lu.discord_id, lu.discord_avatar
      FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
    ) u ON true
    LEFT JOIN user_preferences up ON up.user_id = u.id
    WHERE d.league_slug || '-d' || d.division_tier || '-' || d.season_slug = ${setKey}
    ORDER BY d.card_index
  `

  const cards = defs.map(d => ({
    defId: d.id,
    cardIndex: d.card_index,
    playerName: d.player_name,
    playerSlug: d.player_slug,
    teamName: d.team_name,
    teamColor: d.team_color,
    role: d.role,
    avatarUrl: d.avatar_url,
    isConnected: d.is_claimed,
    bestGodName: d.best_god_name,
  }))

  return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ cards }) }
}

// ═══ GET: Collection search — find player cards by name/discord ═══
async function handleCollectionSearch(sql, params) {
  const { q } = params || {}
  if (!q || q.trim().length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) }
  }

  const query = q.trim()
  const defs = await sql`
    SELECT d.id, d.card_index, d.player_name, d.player_slug, d.team_name, d.team_color,
           d.role, d.best_god_name,
           CASE
             WHEN COALESCE(up.allow_discord_avatar, true) AND u.discord_id IS NOT NULL AND u.discord_avatar IS NOT NULL
             THEN 'https://cdn.discordapp.com/avatars/' || u.discord_id || '/' || u.discord_avatar || '.webp?size=256'
             WHEN COALESCE(up.allow_discord_avatar, true) THEN d.avatar_url
             ELSE NULL
           END AS avatar_url,
           d.league_slug, d.division_tier, d.division_slug, d.season_slug,
           div.name AS division_name,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM cc_player_defs d
    LEFT JOIN players p ON p.slug = d.player_slug
    LEFT JOIN LATERAL (
      SELECT lu.id, lu.discord_id, lu.discord_avatar
      FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
    ) u ON true
    LEFT JOIN user_preferences up ON up.user_id = u.id
    JOIN divisions div ON d.division_id = div.id
    WHERE (d.player_name ILIKE ${'%' + query + '%'} OR u.discord_username ILIKE ${'%' + query + '%'})
    ORDER BY d.player_name, d.league_slug, d.division_tier
    LIMIT 30
  `

  const results = defs.map(d => ({
    defId: d.id,
    cardIndex: d.card_index,
    playerName: d.player_name,
    playerSlug: d.player_slug,
    teamName: d.team_name,
    teamColor: d.team_color,
    role: d.role,
    avatarUrl: d.avatar_url,
    isConnected: d.is_claimed,
    bestGodName: d.best_god_name,
    leagueSlug: d.league_slug,
    divisionTier: d.division_tier,
    divisionSlug: d.division_slug,
    divisionName: d.division_name,
    seasonSlug: d.season_slug,
  }))

  return { statusCode: 200, headers, body: JSON.stringify({ results }) }
}

// ═══ GET: Card detail — player stats for a card definition ═══
async function handleCardDetail(sql, params) {
  const { defId } = params || {}
  if (!defId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'defId required' }) }

  // Use direct FK columns (season_id, division_id) instead of slug reverse-lookup
  const [def] = await sql`
    SELECT d.player_slug, d.season_id, d.team_id, d.best_god_name,
           s.name AS season_name, l.name AS league_name, div.name AS division_name
    FROM cc_player_defs d
    JOIN seasons s ON d.season_id = s.id
    JOIN divisions div ON d.division_id = div.id
    JOIN leagues l ON s.league_id = l.id
    WHERE d.id = ${defId}
  `
  if (!def) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Definition not found' }) }

  const [player] = await sql`
    SELECT p.id,
           CASE WHEN u.id IS NOT NULL THEN true ELSE false END AS is_claimed
    FROM players p
    LEFT JOIN LATERAL (
      SELECT lu.id FROM users lu WHERE lu.linked_player_id = p.id LIMIT 1
    ) u ON true
    WHERE p.slug = ${def.player_slug}
  `
  if (!player) return { statusCode: 200, headers, body: JSON.stringify({ stats: null }) }

  const games = await sql`
    SELECT pgs.kills, pgs.deaths, pgs.assists, pgs.damage, pgs.mitigated,
           pgs.god_played, pgs.team_side, g.winner_team_id,
           CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END AS player_team_id
    FROM player_game_stats pgs
    JOIN league_players lp ON pgs.league_player_id = lp.id
    JOIN games g ON pgs.game_id = g.id AND g.is_completed = true
    JOIN matches m ON g.match_id = m.id
    WHERE lp.player_id = ${player.id} AND lp.season_id = ${def.season_id}
      AND CASE pgs.team_side WHEN 1 THEN m.team1_id WHEN 2 THEN m.team2_id END = ${def.team_id}
  `

  let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
  const godCounts = {}
  for (const g of games) {
    gamesPlayed++
    const isWin = g.winner_team_id === g.player_team_id
    if (isWin) wins++
    kills += parseInt(g.kills) || 0
    deaths += parseInt(g.deaths) || 0
    assists += parseInt(g.assists) || 0
    totalDamage += parseInt(g.damage) || 0
    totalMitigated += parseInt(g.mitigated) || 0
    if (g.god_played) {
      if (!godCounts[g.god_played]) godCounts[g.god_played] = { games: 0, wins: 0 }
      godCounts[g.god_played].games++
      if (isWin) godCounts[g.god_played].wins++
    }
  }

  // Compute best god with full stats from game data
  let bestGod = null
  const godEntries = Object.entries(godCounts).sort((a, b) => b[1].games - a[1].games || a[0].localeCompare(b[0]))
  if (godEntries.length > 0) {
    const [godName, godStats] = godEntries[0]
    const slug = godName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGod = {
      name: godName,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: godStats.games,
      winRate: godStats.games > 0 ? Math.round((godStats.wins / godStats.games) * 1000) / 10 : 0,
    }
  } else if (def.best_god_name) {
    const slug = def.best_god_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGod = {
      name: def.best_god_name,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      stats: {
        gamesPlayed, wins,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
        kda: deaths > 0 ? Math.round(((kills + assists / 2) / deaths) * 10) / 10 : kills + assists / 2,
        avgDamage: gamesPlayed > 0 ? Math.round(totalDamage / gamesPlayed) : 0,
        avgMitigated: gamesPlayed > 0 ? Math.round(totalMitigated / gamesPlayed) : 0,
        totalKills: kills, totalDeaths: deaths, totalAssists: assists,
      },
      bestGod,
      bestGodName: def.best_god_name || null,
      seasonName: def.season_name,
    }),
  }
}

// ═══ GET: Load gifts (sent + received) ═══
const MAX_GIFTS = 5
const GIFTABLE_PACKS = ['osl-mixed', 'bsl-mixed']

async function handleLoadGifts(sql, user) {
  const [sent, received, unseenCount, inventory] = await Promise.all([
    sql`
      SELECT g.id, g.recipient_id, g.message, g.created_at, g.pack_type,
             u.discord_username AS recipient_name, u.discord_avatar AS recipient_avatar, u.discord_id AS recipient_discord_id
      FROM cc_gifts g
      JOIN users u ON u.id = g.recipient_id
      WHERE g.sender_id = ${user.id}
      ORDER BY g.created_at DESC
    `,
    sql`
      SELECT g.id, g.sender_id, g.message, g.opened, g.seen, g.created_at, g.opened_at, g.pack_type,
             u.discord_username AS sender_name, u.discord_avatar AS sender_avatar, u.discord_id AS sender_discord_id
      FROM cc_gifts g
      JOIN users u ON u.id = g.sender_id
      WHERE g.recipient_id = ${user.id}
      ORDER BY g.created_at DESC
    `,
    sql`SELECT COUNT(*)::int AS count FROM cc_gifts WHERE recipient_id = ${user.id} AND seen = false`,
    sql`SELECT pack_type, quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND quantity > 0`,
  ])

  const freeGiftsSent = sent.filter(g => g.pack_type === 'gift')

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      sent: sent.map(g => ({
        id: g.id, recipientId: g.recipient_id, recipientName: g.recipient_name,
        recipientAvatar: g.recipient_discord_id && g.recipient_avatar
          ? `https://cdn.discordapp.com/avatars/${g.recipient_discord_id}/${g.recipient_avatar}.webp?size=64` : null,
        message: g.message, createdAt: g.created_at, packType: g.pack_type,
      })),
      received: received.map(g => ({
        id: g.id, senderId: g.sender_id, senderName: g.sender_name,
        senderAvatar: g.sender_discord_id && g.sender_avatar
          ? `https://cdn.discordapp.com/avatars/${g.sender_discord_id}/${g.sender_avatar}.webp?size=64` : null,
        message: g.message, opened: g.opened, seen: g.seen,
        createdAt: g.created_at, openedAt: g.opened_at, packType: g.pack_type,
      })),
      giftsRemaining: MAX_GIFTS - freeGiftsSent.length,
      giftInventory: inventory.map(i => ({ packType: i.pack_type, quantity: i.quantity })),
      unseenCount: unseenCount[0]?.count || 0,
    }),
  }
}

// ═══ GET: Gift leaderboard — top 20 by unique individuals gifted ═══
async function handleGiftLeaderboard(sql, user) {
  const rows = await sql`
    SELECT g.sender_id,
      COUNT(DISTINCT g.recipient_id)::int AS unique_recipients,
      COUNT(*)::int AS total_gifts,
      u.discord_username, u.discord_avatar, u.discord_id,
      pl.slug AS player_slug
    FROM cc_gifts g
    JOIN users u ON g.sender_id = u.id
    LEFT JOIN players pl ON u.linked_player_id = pl.id
    GROUP BY g.sender_id, u.discord_username, u.discord_avatar, u.discord_id, pl.slug
    ORDER BY unique_recipients DESC, total_gifts DESC
    LIMIT 20
  `

  const leaderboard = rows.map((r, i) => ({
    position: i + 1,
    userId: r.sender_id,
    username: r.discord_username,
    avatar: r.discord_avatar,
    discordId: r.discord_id,
    playerSlug: r.player_slug,
    uniqueRecipients: r.unique_recipients,
    totalGifts: r.total_gifts,
  }))

  // Find current user's position if not in top 20
  let myPosition = null
  let myEntry = null
  const inTop = leaderboard.find(e => e.userId === user.id)
  if (!inTop) {
    const [myRow] = await sql`
      SELECT COUNT(DISTINCT recipient_id)::int AS unique_recipients,
        COUNT(*)::int AS total_gifts
      FROM cc_gifts WHERE sender_id = ${user.id}
    `
    if (myRow && myRow.unique_recipients > 0) {
      const [rank] = await sql`
        SELECT COUNT(*)::int + 1 AS rank
        FROM (
          SELECT sender_id, COUNT(DISTINCT recipient_id) AS cnt
          FROM cc_gifts GROUP BY sender_id
        ) sub
        WHERE cnt > ${myRow.unique_recipients}
      `
      myPosition = rank?.rank || null
      myEntry = {
        position: myPosition,
        userId: user.id,
        username: user.discord_username,
        avatar: user.discord_avatar,
        discordId: user.discord_id,
        uniqueRecipients: myRow.unique_recipients,
        totalGifts: myRow.total_gifts,
      }
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ leaderboard, myPosition, myEntry }),
  }
}

// ═══ GET: Pack opening leaderboard (daily/weekly/monthly) ═══
function getLeaderboardCutoff(period) {
  const now = new Date()
  if (period === 'daily') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  } else if (period === 'weekly') {
    const day = now.getUTCDay()
    const diff = day === 0 ? 6 : day - 1 // Monday = 0 offset
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff))
    return d
  } else {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }
}

async function handlePackLeaderboard(sql, user, qs) {
  const period = qs?.period || 'daily'
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid period' }) }
  }

  const cutoff = getLeaderboardCutoff(period)

  const rows = await sql`
    SELECT po.user_id, COUNT(*)::int AS packs_opened,
           u.discord_username, u.discord_avatar, u.discord_id,
           pl.slug AS player_slug
    FROM cc_pack_opens po
    JOIN users u ON po.user_id = u.id
    LEFT JOIN players pl ON u.linked_player_id = pl.id
    WHERE po.created_at >= ${cutoff.toISOString()}
    GROUP BY po.user_id, u.discord_username, u.discord_avatar, u.discord_id, pl.slug
    ORDER BY packs_opened DESC
    LIMIT 20
  `

  const leaderboard = rows.map((r, i) => ({
    position: i + 1,
    userId: r.user_id,
    username: r.discord_username,
    avatar: r.discord_avatar,
    discordId: r.discord_id,
    playerSlug: r.player_slug,
    packsOpened: r.packs_opened,
  }))

  let myPosition = null
  let myEntry = null
  if (user) {
    const inTop = leaderboard.find(e => e.userId === user.id)
    if (!inTop) {
      const [myRow] = await sql`
        SELECT COUNT(*)::int AS packs_opened
        FROM cc_pack_opens
        WHERE user_id = ${user.id} AND created_at >= ${cutoff.toISOString()}
      `
      if (myRow && myRow.packs_opened > 0) {
        const [rank] = await sql`
          SELECT COUNT(*)::int + 1 AS rank
          FROM (
            SELECT user_id, COUNT(*) AS cnt
            FROM cc_pack_opens
            WHERE created_at >= ${cutoff.toISOString()}
            GROUP BY user_id
          ) sub
          WHERE cnt > ${myRow.packs_opened}
        `
        myPosition = rank?.rank || null
        myEntry = {
          position: myPosition,
          userId: user.id,
          username: user.discord_username,
          avatar: user.discord_avatar,
          discordId: user.discord_id,
          packsOpened: myRow.packs_opened,
        }
      }
    }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ leaderboard, myPosition, myEntry }),
  }
}

// ═══ POST: Send a gift pack ═══
async function handleSendGift(sql, user, body, event) {
  const { recipientId, message, packType = 'gift' } = body
  if (!recipientId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Recipient required' }) }
  if (recipientId === user.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot gift yourself' }) }

  // Check recipient exists
  const [recipient] = await sql`SELECT id FROM users WHERE id = ${recipientId}`
  if (!recipient) return { statusCode: 400, headers, body: JSON.stringify({ error: 'User not found' }) }

  if (packType === 'gift') {
    // Free gift packs: limited to 5 total, one per recipient
    const [sentCount] = await sql`SELECT COUNT(*)::int AS count FROM cc_gifts WHERE sender_id = ${user.id} AND pack_type = 'gift'`
    if (sentCount.count >= MAX_GIFTS) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No free gifts remaining' }) }
    }
    const [existing] = await sql`SELECT id FROM cc_gifts WHERE sender_id = ${user.id} AND recipient_id = ${recipientId} AND pack_type = 'gift'`
    if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already sent a free gift to this user' }) }
  } else {
    // Purchased packs: decrement from inventory
    if (!GIFTABLE_PACKS.includes(packType)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid gift pack type' }) }
    }
    const [inv] = await sql`SELECT quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND pack_type = ${packType}`
    if (!inv || inv.quantity <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No packs of this type in your gift inventory' }) }
    }
    await sql`UPDATE cc_gift_inventory SET quantity = quantity - 1 WHERE user_id = ${user.id} AND pack_type = ${packType}`
  }

  const trimmedMsg = message ? message.trim().slice(0, 200) : null

  await sql`
    INSERT INTO cc_gifts (sender_id, recipient_id, message, pack_type)
    VALUES (${user.id}, ${recipientId}, ${trimmedMsg}, ${packType})
  `

  maybePushChallenges(sql, user.id)

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Buy a pack for gifting ═══
async function handleBuyGiftPack(sql, user, body) {
  const { packType } = body || {}
  if (!packType || !GIFTABLE_PACKS.includes(packType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pack type' }) }
  }

  const [pack] = await sql`SELECT id, cost, name FROM cc_pack_types WHERE id = ${packType} AND enabled = true`
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack type not found' }) }

  await ensureEmberBalance(sql, user.id)
  const [bal] = await sql`SELECT balance FROM ember_balances WHERE user_id = ${user.id}`
  if (!bal || bal.balance < pack.cost) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Need ${pack.cost} Cores` }) }
  }

  await grantEmber(sql, user.id, 'cc_gift_pack', -pack.cost, `Card Clash: ${pack.name} (gift)`)

  await sql`
    INSERT INTO cc_gift_inventory (user_id, pack_type, quantity)
    VALUES (${user.id}, ${packType}, 1)
    ON CONFLICT (user_id, pack_type) DO UPDATE SET quantity = cc_gift_inventory.quantity + 1
  `

  const inventory = await sql`SELECT pack_type, quantity FROM cc_gift_inventory WHERE user_id = ${user.id} AND quantity > 0`

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      giftInventory: inventory.map(i => ({ packType: i.pack_type, quantity: i.quantity })),
    }),
  }
}

// ═══ POST: Open a received gift ═══
async function handleOpenGift(sql, user, body) {
  const { giftId } = body
  if (!giftId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift ID required' }) }

  const [gift] = await sql`
    SELECT * FROM cc_gifts WHERE id = ${giftId} AND recipient_id = ${user.id} AND opened = false
  `
  if (!gift) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift not found or already opened' }) }

  let packName, newCards, packOpenId

  if (gift.pack_type === 'gift') {
    // Free gift pack — use dedicated generator
    const cards = await generateGiftPack(sql)
    newCards = []
    const hasStaffGift = cards.some(c => c.card_type === 'staff')
    let giftPassiveIds = []
    let giftPassiveMap = {}
    if (hasStaffGift) {
      const passives = await sql`SELECT id, name FROM cc_staff_passives`
      giftPassiveIds = passives.map(r => r.id)
      giftPassiveMap = Object.fromEntries(passives.map(r => [r.id, r.name]))
    }

    for (const card of cards) {
      const giftPassiveId = card.card_type === 'staff' && giftPassiveIds.length > 0
        ? giftPassiveIds[Math.floor(Math.random() * giftPassiveIds.length)]
        : null

      const [inserted] = await sql`
        INSERT INTO cc_cards (owner_id, original_owner_id, god_id, god_name, god_class, role, rarity, serial_number, holo_effect, holo_type, image_url, acquired_via, card_type, card_data, def_id, passive_id)
        VALUES (${user.id}, ${user.id}, ${card.god_id}, ${card.god_name}, ${card.god_class}, ${card.role}, ${card.rarity}, ${card.serial_number}, ${card.holo_effect}, ${card.holo_type}, ${card.image_url}, ${'gift'}, ${card.card_type}, ${card.card_data ? JSON.stringify(card.card_data) : null}, ${card.def_id || null}, ${giftPassiveId})
        RETURNING *
      `
      if (card._revealOrder != null) inserted._revealOrder = card._revealOrder
      if (inserted.passive_id) inserted.passive_name = giftPassiveMap[inserted.passive_id] || null
      newCards.push(inserted)
    }
    await ensureStats(sql, user.id)
    await sql`UPDATE cc_stats SET packs_opened = packs_opened + 1 WHERE user_id = ${user.id}`
    const giftCardIds = newCards.map(c => c.id)
    const [giftPackOpen] = await sql`
      INSERT INTO cc_pack_opens (user_id, pack_type_id, card_ids)
      VALUES (${user.id}, NULL, ${JSON.stringify(giftCardIds)}::jsonb)
      RETURNING id
    `
    packOpenId = giftPackOpen.id
    packName = 'Gift Pack'
  } else {
    // Purchased pack gift — use standard pack opener (skip payment, already paid)
    const result = await openPack(sql, user.id, gift.pack_type, { skipPayment: true })
    packName = result.packName
    newCards = result.cards
    packOpenId = result.packOpenId
  }

  // Mark gift as opened
  await sql`UPDATE cc_gifts SET opened = true, seen = true, opened_at = NOW() WHERE id = ${giftId}`

  maybePushChallenges(sql, user.id)

  const cards = newCards.map(c => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })
  await tagNewCards(sql, user.id, cards)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ packName, packType: gift.pack_type, cards, packOpenId }),
  }
}

// ═══ GET: Pending pack reveal (unrevealed pack open) ═══
async function handlePendingReveal(sql, user) {
  const [pending] = await sql`
    SELECT id, pack_type_id, card_ids, created_at
    FROM cc_pack_opens
    WHERE user_id = ${user.id} AND revealed_at IS NULL AND card_ids IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
  `
  if (!pending || !pending.card_ids || !pending.card_ids.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ pending: null }) }
  }

  const cardIds = pending.card_ids
  const cards = await sql`
    SELECT c.*, sp.name AS passive_name
    FROM cc_cards c
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE c.id = ANY(${cardIds}) AND c.owner_id = ${user.id}
  `
  if (!cards.length) {
    // Cards gone (dismantled/traded) — auto-reveal stale record
    await sql`UPDATE cc_pack_opens SET revealed_at = NOW() WHERE user_id = ${user.id} AND revealed_at IS NULL`
    return { statusCode: 200, headers, body: JSON.stringify({ pending: null }) }
  }

  const formatted = cards.map(c => formatCard(c))
  await inlineBlueprintData(sql, formatted)
  await tagNewCards(sql, user.id, formatted)

  // Restore reveal order for mixed packs
  for (const c of formatted) {
    const orig = cards.find(r => r.id === c.id)
    if (orig?.card_data?._revealOrder != null) c._revealOrder = orig.card_data._revealOrder
  }

  let packName = 'Pack'
  if (pending.pack_type_id) {
    const [pt] = await sql`SELECT name FROM cc_pack_types WHERE id = ${pending.pack_type_id}`
    if (pt) packName = pt.name
  } else {
    packName = 'Gift Pack'
  }

  return { statusCode: 200, headers, body: JSON.stringify({
    pending: {
      packOpenId: pending.id,
      packName,
      packType: pending.pack_type_id,
      cards: formatted,
    }
  }) }
}

// ═══ POST: Mark pack opens as revealed ═══
async function handleMarkRevealed(sql, user) {
  await sql`UPDATE cc_pack_opens SET revealed_at = NOW() WHERE user_id = ${user.id} AND revealed_at IS NULL`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ POST: Mark all gifts as seen ═══
async function handleMarkGiftsSeen(sql, user) {
  await sql`UPDATE cc_gifts SET seen = true WHERE recipient_id = ${user.id} AND seen = false`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ GET: Search users for gifting ═══
async function handleSearchUsers(sql, user, params) {
  const { q } = params || {}
  if (!q || q.trim().length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ users: [] }) }
  }

  const query = q.trim()
  const results = await sql`
    SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id, p.name AS player_name
    FROM users u
    LEFT JOIN players p ON p.id = u.linked_player_id
    WHERE u.id != ${user.id}
      AND (u.discord_username ILIKE ${'%' + query + '%'} OR p.name ILIKE ${'%' + query + '%'})
    ORDER BY u.discord_username ASC
    LIMIT 10
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      users: results.map(u => ({
        id: u.id,
        discordUsername: u.discord_username,
        playerName: u.player_name,
        avatar: u.discord_id && u.discord_avatar
          ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.webp?size=64` : null,
      })),
    }),
  }
}

// ═══ GET: Definition overrides ═══
async function handleDefinitionOverrides(sql) {
  const overrides = await sql`SELECT type, definition_id, metadata FROM cc_definition_overrides`
  const map = {}
  for (const o of overrides) {
    map[`${o.type}:${o.definition_id}`] = o.metadata || {}
  }
  return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=1800' }, body: JSON.stringify({ overrides: map }) }
}

// ═══ POST: Dismantle cards for Ember ═══
const DISMANTLE_VALUES = {
  common: 0.2, uncommon: 1, rare: 3, epic: 8, legendary: 25, mythic: 75,
}
const DISMANTLE_TIERS = [
  { upTo: 120, rate: 1.0 },
  { upTo: 160, rate: 0.75 },
  { upTo: 200, rate: 0.5 },
  { upTo: Infinity, rate: 0.25 },
]

async function handleDismantle(sql, user, body) {
  const { cardIds } = body
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No cards selected' }) }
  }
  if (cardIds.length > 200) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Too many cards (max 200)' }) }
  }

  // Fetch cards owned by user, excluding unique, those locked on market, in active trades, or in Starting 5
  const cards = await sql`
    SELECT c.id, c.rarity FROM cc_cards c
    WHERE c.id = ANY(${cardIds}) AND c.owner_id = ${user.id}
      AND c.rarity != 'unique'
      AND NOT EXISTS (
        SELECT 1 FROM cc_market_listings ml
        WHERE ml.card_id = c.id AND ml.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_trade_cards tc
        JOIN cc_trades t ON tc.trade_id = t.id
        WHERE tc.card_id = c.id AND t.status IN ('waiting', 'active')
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_lineups l
        WHERE (l.card_id = c.id OR l.god_card_id = c.id OR l.item_card_id = c.id) AND l.user_id = ${user.id}
      )
      AND NOT EXISTS (
        SELECT 1 FROM cc_binder_cards bc WHERE bc.card_id = c.id
      )
  `
  if (cards.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid cards found — some may be in your Starting 5, listed on the market, in a trade, or in your binder' }) }
  }

  // Count legendaries before deleting
  const legendaryCount = cards.filter(c => c.rarity === 'legendary' || c.rarity === 'mythic').length
  const validIds = cards.map(c => c.id)

  // Check for active dismantle boost
  const [s5State] = await sql`
    SELECT dismantle_boost_mult, dismantle_boost_date
    FROM cc_starting_five_state WHERE user_id = ${user.id}
  `
  const today = new Date().toISOString().slice(0, 10)
  let dismantleThresholdMult = 1
  const boostDateStr = s5State?.dismantle_boost_date instanceof Date
    ? s5State.dismantle_boost_date.toISOString().slice(0, 10)
    : String(s5State?.dismantle_boost_date || '').slice(0, 10)
  if (boostDateStr === today && Number(s5State.dismantle_boost_mult) > 1) {
    dismantleThresholdMult = Number(s5State.dismantle_boost_mult)
  } else if (boostDateStr && boostDateStr < today) {
    await sql`
      UPDATE cc_starting_five_state
      SET dismantle_boost_mult = 1.0, dismantle_boost_date = NULL
      WHERE user_id = ${user.id}
    `
  }

  const effectiveTiers = dismantleThresholdMult > 1
    ? DISMANTLE_TIERS.map(t => ({ ...t, upTo: t.upTo === Infinity ? Infinity : t.upTo * dismantleThresholdMult }))
    : DISMANTLE_TIERS

  // Fetch current daily dismantle stats (reset if new day)
  await ensureStats(sql, user.id)
  const [currentStats] = await sql`SELECT dismantled_today, dismantled_value_today, dismantle_reset_date FROM cc_stats WHERE user_id = ${user.id}`
  const isToday = currentStats.dismantle_reset_date === today
  const dismantledToday = isToday ? (currentStats.dismantled_today || 0) : 0
  const dismantledValueToday = isToday ? (parseFloat(currentStats.dismantled_value_today) || 0) : 0

  // Sort by rarity value descending so highest-value cards get the best rate
  cards.sort((a, b) => (DISMANTLE_VALUES[b.rarity] || 0) - (DISMANTLE_VALUES[a.rarity] || 0))

  // Calculate total with value-based diminishing returns (split across tier boundaries)
  let total = 0
  let cumulativeBase = dismantledValueToday
  let batchBaseValue = 0
  for (const card of cards) {
    const base = DISMANTLE_VALUES[card.rarity] || 0
    let remaining = base
    let pos = cumulativeBase
    for (const tier of effectiveTiers) {
      if (remaining <= 0) break
      if (pos >= tier.upTo) continue
      const chunk = tier.upTo === Infinity ? remaining : Math.min(tier.upTo - pos, remaining)
      total += chunk * tier.rate
      remaining -= chunk
      pos += chunk
    }
    cumulativeBase += base
    batchBaseValue += base
  }
  const emberGained = Math.floor(Math.round(total * 10) / 10)

  if (emberGained < 1) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selected cards are worth less than 1 Ember' }) }
  }

  // Delete the cards (clean up trade references first to avoid FK violations)
  await sql`
    DELETE FROM cc_trade_cards tc
    USING cc_trades t
    WHERE tc.trade_id = t.id AND tc.card_id = ANY(${validIds})
      AND t.status NOT IN ('waiting', 'active')
  `
  // NULL out swipe references in cc_trades before card deletion cascades to cc_swipes
  await sql`
    UPDATE cc_trades SET match_swipe_a_id = NULL
    WHERE match_swipe_a_id IN (SELECT id FROM cc_swipes WHERE card_id = ANY(${validIds}))
  `
  await sql`
    UPDATE cc_trades SET match_swipe_b_id = NULL
    WHERE match_swipe_b_id IN (SELECT id FROM cc_swipes WHERE card_id = ANY(${validIds}))
  `
  await sql`UPDATE cc_promo_gifts SET card_id = NULL WHERE card_id = ANY(${validIds})`
  await sql`DELETE FROM cc_cards WHERE id = ANY(${validIds}) AND owner_id = ${user.id}`

  // Grant ember
  const { balance } = await grantEmber(sql, user.id, 'dismantle', emberGained, `Dismantled ${validIds.length} card${validIds.length > 1 ? 's' : ''}`)

  // Update dismantle stats + daily counters
  const newDismantledToday = dismantledToday + validIds.length
  const newDismantledValueToday = dismantledValueToday + batchBaseValue
  await sql`
    UPDATE cc_stats SET
      cards_dismantled = cards_dismantled + ${validIds.length},
      legendary_cards_dismantled = legendary_cards_dismantled + ${legendaryCount},
      dismantled_today = ${newDismantledToday},
      dismantled_value_today = ${newDismantledValueToday},
      dismantle_reset_date = ${today}
    WHERE user_id = ${user.id}
  `

  maybePushChallenges(sql, user.id)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ dismantled: validIds.length, emberGained, balance, dismantledToday: newDismantledToday, dismantledValueToday: newDismantledValueToday }),
  }
}

// ═══ POST: Black Market — turn in Brudih cards ═══
const BLACK_MARKET_REWARDS = {
  common: 3, uncommon: 5, rare: 7, epic: 10, legendary: 15,
}

async function handleBlackMarketTurnIn(sql, user, body) {
  const { cardId } = body
  if (!cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  }

  let result
  try {
  result = await transaction(async (tx) => {
    // Fetch card + player def in one query, with lock guards
    const [card] = await tx`
      SELECT c.id, c.rarity, c.owner_id, d.player_name, d.league_id, l.slug AS league_slug
      FROM cc_cards c
      JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
      JOIN leagues l ON d.league_id = l.id
      WHERE c.id = ${cardId} AND c.owner_id = ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM cc_market_listings ml
          WHERE ml.card_id = c.id AND ml.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_trade_cards tc
          JOIN cc_trades t ON tc.trade_id = t.id
          WHERE tc.card_id = c.id AND t.status IN ('waiting', 'active') AND t.mode = 'direct'
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_lineups ln
          WHERE (ln.card_id = c.id OR ln.god_card_id = c.id OR ln.item_card_id = c.id) AND ln.user_id = ${user.id}
        )
        AND NOT EXISTS (
          SELECT 1 FROM cc_binder_cards bc WHERE bc.card_id = c.id
        )
    `
    if (!card) {
      throw new Error('Card not found, not a Brudih, or is locked (market/trade/lineup/binder)')
    }
    if (card.player_name !== 'Brudih') {
      throw new Error('Card is not a Brudih card')
    }
    if (card.rarity === 'unique') {
      throw new Error('Unique cards cannot be turned in')
    }

    // Check pending mythic claim
    await ensureStats(tx, user.id)
    const [userStats] = await tx`SELECT pending_mythic_claim FROM cc_stats WHERE user_id = ${user.id}`
    if (userStats.pending_mythic_claim > 0) {
      throw new Error('You must claim your pending mythic card first')
    }

    const isMythic = card.rarity === 'mythic'
    const rewardCount = BLACK_MARKET_REWARDS[card.rarity]
    if (!isMythic && !rewardCount) {
      throw new Error(`No reward defined for rarity: ${card.rarity}`)
    }

    // Determine league pack type
    const packTypeId = `${card.league_slug}-mixed`
    if (!isMythic) {
      const [packType] = await tx`SELECT id FROM cc_pack_types WHERE id = ${packTypeId} AND enabled = true`
      if (!packType) {
        throw new Error(`No pack type found for league: ${card.league_slug}`)
      }
    }

    // Clean up completed trade references (same as dismantle)
    await tx`
      DELETE FROM cc_trade_cards tc
      USING cc_trades t
      WHERE tc.trade_id = t.id AND tc.card_id = ${cardId}
        AND t.status NOT IN ('waiting', 'active')
    `

    // Transfer card to Brudih's user account (via players → users link)
    const [brudihUser] = await tx`
      SELECT u.id FROM users u
      JOIN players p ON u.linked_player_id = p.id
      JOIN cc_player_defs d ON d.player_id = p.id
      WHERE d.player_name = 'Brudih'
      LIMIT 1
    `
    await tx`DELETE FROM cc_signature_requests WHERE card_id = ${cardId} AND status IN ('pending', 'awaiting_approval')`
    if (brudihUser) {
      await tx`UPDATE cc_cards SET owner_id = ${brudihUser.id} WHERE id = ${cardId}`
    } else {
      await tx`DELETE FROM cc_cards WHERE id = ${cardId} AND owner_id = ${user.id}`
    }

    // Grant reward
    if (isMythic) {
      await tx`
        UPDATE cc_stats SET
          brudihs_turned_in = brudihs_turned_in + 1,
          pending_mythic_claim = pending_mythic_claim + 1
        WHERE user_id = ${user.id}
      `
      return { type: 'mythic_choice' }
    } else {
      // Insert packs into inventory
      await tx`
        INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
        SELECT ${user.id}, ${packTypeId}, 'black-market'
        FROM generate_series(1, ${rewardCount})
      `
      await tx`
        UPDATE cc_stats SET brudihs_turned_in = brudihs_turned_in + 1
        WHERE user_id = ${user.id}
      `
      return { type: 'packs', packType: packTypeId, count: rewardCount }
    }
  })
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, reward: result }),
  }
}

async function handleBlackMarketClaimMythic(sql, user, body) {
  const { cardType, godId } = body
  if (!cardType || !godId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardType and godId required' }) }
  }

  const validTypes = ['god', 'item', 'consumable', 'player', 'minion']
  if (!validTypes.includes(cardType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid cardType: ${cardType}` }) }
  }

  const result = await transaction(async (tx) => {
    await ensureStats(tx, user.id)
    const [stats] = await tx`SELECT pending_mythic_claim FROM cc_stats WHERE user_id = ${user.id}`
    if (!stats || stats.pending_mythic_claim <= 0) {
      throw new Error('No pending mythic claim')
    }

    // Validate card definition exists
    let defId = null
    if (cardType === 'player') {
      if (!body.godName) throw new Error('godName required for player cards')
      const [def] = await tx`SELECT id FROM cc_player_defs WHERE player_name = ${body.godName} LIMIT 1`
      if (!def) throw new Error('Player definition not found')
      defId = def.id
    } else {
      if (!godId || typeof godId !== 'string') throw new Error('Invalid godId')
    }

    const serialNumber = Math.floor(Math.random() * 9999) + 1

    let passiveId = null
    let passiveName = null
    if (cardType === 'staff') {
      const passives = await tx`SELECT id, name FROM cc_staff_passives`
      if (passives.length > 0) {
        const picked = passives[Math.floor(Math.random() * passives.length)]
        passiveId = picked.id
        passiveName = picked.name
      }
    }

    const [card] = await tx`
      INSERT INTO cc_cards (
        owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
        serial_number, holo_effect, holo_type, acquired_via, card_type,
        def_id, passive_id
      )
      VALUES (
        ${user.id}, ${user.id}, ${godId}, ${body.godName || ''}, ${body.godClass || ''},
        ${body.role || ''}, 'mythic',
        ${serialNumber}, 'rainbow', 'holo', 'black-market', ${cardType},
        ${defId}, ${passiveId}
      )
      RETURNING *
    `
    card.passive_name = passiveName

    await tx`
      UPDATE cc_stats SET pending_mythic_claim = pending_mythic_claim - 1
      WHERE user_id = ${user.id}
    `

    return card
  })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, card: formatCard(result) }),
  }
}

async function handleBlackMarketDebugPending(sql, user) {
  await ensureStats(sql, user.id)
  await sql`UPDATE cc_stats SET pending_mythic_claim = pending_mythic_claim + 1 WHERE user_id = ${user.id}`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ Starting 5 ═══

function formatS5Response(state, extra = {}) {
  const { csCards = [], asCards = [], csOutput, asOutput } = state

  function formatLineup(lineupCards, output) {
    // Compute team synergy (bench now included, role mismatches excluded)
    const teamCounts = {}
    for (const card of lineupCards) {
      if (isRoleMismatch(card)) continue
      if (card.team_id) teamCounts[card.team_id] = (teamCounts[card.team_id] || 0) + 1
    }

    const slots = {}
    for (const card of lineupCards) {
      const synergy = checkSynergy(card, card._godCard)
      const contrib = getCardContribution(card.holo_type, card.rarity, card.isBench ? 0.5 : 1.0)
      const godBonusInfo = getAttachmentBonusInfo(card._godCard, 'god', card.holo_type, synergy)
      const itemBonusInfo = getAttachmentBonusInfo(card._itemCard, 'item', card.holo_type)
      const roleMismatch = isRoleMismatch(card)

      // Per-card team bonus — only for cards whose team has 2+ members
      const cardTeamBonus = (!roleMismatch && card.team_id)
        ? (TEAM_SYNERGY_BONUS[teamCounts[card.team_id]] || 0)
        : 0

      slots[card.slot_role] = {
        card: formatCard(card),
        godCard: card._godCard ? formatCard(card._godCard) : null,
        itemCard: card._itemCard ? formatCard(card._itemCard) : null,
        contribution: contrib,
        godBonus: godBonusInfo,
        itemBonus: itemBonusInfo,
        synergy,
        isBench: card.isBench || false,
        teamSynergyBonus: cardTeamBonus,
        roleMismatch,
      }
    }
    return { slots, output: output || { coresPerDay: 0, passionPerDay: 0 } }
  }

  const combined = {
    coresPerDay: (csOutput?.coresPerDay || 0) + (asOutput?.coresPerDay || 0) * S5_ALLSTAR_MODIFIER,
    passionPerDay: (csOutput?.passionPerDay || 0) + (asOutput?.passionPerDay || 0) * S5_ALLSTAR_MODIFIER,
  }

  const buffTotals = getBuffTotals(state.activeBuffs || [])

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      currentSeason: formatLineup(csCards, csOutput),
      allStar: formatLineup(asCards, asOutput),
      combined,
      passionPending: state.passionPending,
      coresPending: state.coresPending,
      passionCap: state.passionCap,
      coresCap: state.coresCap,
      activeBuffs: state.activeBuffs || [],
      consumableSlotsUsed: state.consumableSlotsUsed || 0,
      consumablesUsedToday: state.consumablesUsedToday || 0,
      consumableDailyCap: CONSUMABLE_DAILY_CAP,
      dismantleBoostMult: state.dismantleBoostMult || 1,
      dismantleBoostActive: (() => {
        const today = new Date().toISOString().slice(0, 10)
        const d = state.dismantleBoostDate
        if (!d) return false
        const dateStr = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
        return dateStr === today
      })(),
      effectiveRateBoost: buffTotals.totalRateBoost,
      effectiveCapDays: buffTotals.totalCapDays,
      effectiveCollectMult: buffTotals.totalCollectMult,
      ...extra,
    }),
  }
}

async function loadPassiveState(sql, userId) {
  const passiveData = await getActivePassive(sql, userId)
  if (!passiveData) return null

  const generatedCards = passiveData.passiveName === 'card_generator'
    ? await getGeneratedCards(sql, userId)
    : []

  // Trigger Card Generator if charges available
  if (passiveData.passiveName === 'card_generator' && passiveData.charges > 0) {
    try {
      const { generatePassiveCard } = await import('../lib/passives.js')
      await spendCharge(sql, userId, 'card_generator', passiveData.staffRarity)
      const newGen = await generatePassiveCard(sql, userId, passiveData.staffRarity)
      if (newGen) generatedCards.unshift(newGen)
      const refreshed = await getActivePassive(sql, userId)
      if (refreshed) Object.assign(passiveData, refreshed)
    } catch {
      // Charge may have been spent between check and spend — ignore
    }
  }

  const cooldown = await checkSwapCooldown(sql, userId)

  return {
    name: passiveData.passiveName,
    staffRarity: passiveData.staffRarity,
    charges: passiveData.charges,
    maxCharges: passiveData.maxCharges,
    chargeProgressPct: passiveData.chargeProgressPct,
    nextChargeIn: passiveData.nextChargeIn,
    cooldownUntil: cooldown?.cooldownUntil || null,
    enabled: passiveData.enabled,
    holoChoice: passiveData.holoChoice,
    generatedCards: generatedCards.map(g => ({ id: g.id, rarity: g.rarity || g.card_data?.rarity, createdAt: g.created_at })),
  }
}

function formatS5WithPassive(resp, passiveState) {
  const parsed = JSON.parse(resp.body)
  parsed.passiveState = passiveState
  return { ...resp, body: JSON.stringify(parsed) }
}

async function handleStartingFive(sql, user) {
  const state = await tick(sql, user.id)
  const passiveState = await loadPassiveState(sql, user.id)
  return formatS5WithPassive(formatS5Response(state), passiveState)
}

async function handleS5Leaderboard(sql, user) {
  const rows = await sql`
    SELECT l.user_id, l.role AS slot_role, l.lineup_type,
      c.rarity, c.holo_type, c.card_type, c.role,
      pd.best_god_name, pd.team_id,
      g.rarity AS god_rarity, g.holo_type AS god_holo_type, g.card_type AS god_card_type,
      g.god_name AS god_god_name, g.role AS god_role,
      i.rarity AS item_rarity, i.holo_type AS item_holo_type, i.card_type AS item_card_type,
      u.discord_username, u.discord_avatar, u.discord_id,
      pl.slug AS player_slug
    FROM cc_lineups l
    JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_player_defs pd ON c.def_id = pd.id AND c.card_type = 'player'
    LEFT JOIN cc_cards g ON l.god_card_id = g.id
    LEFT JOIN cc_cards i ON l.item_card_id = i.id
    JOIN users u ON l.user_id = u.id
    LEFT JOIN players pl ON u.linked_player_id = pl.id
    WHERE l.card_id IS NOT NULL
  `

  const byUser = {}
  for (const r of rows) {
    if (!byUser[r.user_id]) {
      byUser[r.user_id] = {
        userId: r.user_id,
        username: r.discord_username,
        avatar: r.discord_avatar,
        discordId: r.discord_id,
        playerSlug: r.player_slug,
        cards: [],
      }
    }
    byUser[r.user_id].cards.push(r)
  }

  const entries = []
  for (const u of Object.values(byUser)) {
    // Reshape cards and split by lineup type
    const shaped = u.cards.map(c => {
      c.isBench = c.slot_role === 'bench'
      c._godCard = c.god_rarity ? { rarity: c.god_rarity, holo_type: c.god_holo_type, god_name: c.god_god_name } : null
      c._itemCard = c.item_rarity ? { rarity: c.item_rarity, holo_type: c.item_holo_type } : null
      return c
    })

    const csCards = shaped.filter(c => c.lineup_type === 'current')
    const asCards = shaped.filter(c => c.lineup_type === 'allstar')

    function getTeamCounts(lineupCards) {
      const counts = {}
      for (const c of lineupCards) {
        if (isRoleMismatch(c)) continue
        if (c.team_id) counts[c.team_id] = (counts[c.team_id] || 0) + 1
      }
      return counts
    }

    const csOutput = calculateLineupOutput(csCards, getTeamCounts(csCards))
    const asOutput = calculateLineupOutput(asCards, getTeamCounts(asCards))

    const coresPerDay = csOutput.coresPerDay + asOutput.coresPerDay * S5_ALLSTAR_MODIFIER
    const passionPerDay = csOutput.passionPerDay + asOutput.passionPerDay * S5_ALLSTAR_MODIFIER

    if (coresPerDay === 0 && passionPerDay === 0) continue

    const coresCap = coresPerDay * 2
    const passionCap = passionPerDay * 2

    entries.push({
      userId: u.userId,
      username: u.username,
      avatar: u.avatar,
      discordId: u.discordId,
      playerSlug: u.playerSlug,
      coresPerDay: +coresPerDay.toFixed(1),
      passionPerDay: +passionPerDay.toFixed(1),
      passionCap: +passionCap.toFixed(1),
      coresCap: +coresCap.toFixed(1),
      totalCap: +(passionCap + coresCap).toFixed(1),
      cardCount: u.cards.length,
    })
  }

  entries.sort((a, b) => b.totalCap - a.totalCap)
  const top = entries.slice(0, 20).map((e, i) => ({ ...e, position: i + 1 }))
  const myEntry = entries.find(e => e.userId === user.id)
  const myPosition = myEntry ? entries.indexOf(myEntry) + 1 : null

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      leaderboard: top,
      myPosition,
      myEntry: myEntry && myPosition > 20 ? { ...myEntry, position: myPosition } : null,
    }),
  }
}

async function handleSlotCard(sql, user, body) {
  const { cardId, role, slotType, lineupType } = body
  if (!cardId || !role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId and role required' }) }
  }
  const state = await slotCard(sql, user.id, cardId, role, slotType || 'player', lineupType || 'current')

  maybePushChallenges(sql, user.id)

  const passiveState = await loadPassiveState(sql, user.id)
  return formatS5WithPassive(formatS5Response(state), passiveState)
}

async function handleUnslotCard(sql, user, body) {
  const { role, lineupType } = body
  if (!role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role required' }) }
  }
  const state = await unslotCard(sql, user.id, role, lineupType || 'current')

  maybePushChallenges(sql, user.id)

  const passiveState = await loadPassiveState(sql, user.id)
  return formatS5WithPassive(formatS5Response(state), passiveState)
}

async function handleUnslotAttachment(sql, user, body) {
  const { role, slotType, lineupType } = body
  if (!role || !slotType) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'role and slotType required' }) }
  }
  const state = await unslotAttachment(sql, user.id, role, slotType, lineupType || 'current')

  maybePushChallenges(sql, user.id)

  const passiveState = await loadPassiveState(sql, user.id)
  return formatS5WithPassive(formatS5Response(state), passiveState)
}

async function handleUseConsumable(sql, user, body) {
  const { cardId } = body
  if (!cardId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  }
  const state = await transaction(async (tx) => {
    return await applyConsumable(tx, user.id, cardId)
  })

  maybePushChallenges(sql, user.id)

  const response = formatS5Response(state)
  const responseData = JSON.parse(response.body)
  responseData.consumableResult = state.consumableResult
  return { ...response, body: JSON.stringify(responseData) }
}

async function handleCollectIncome(sql, user) {
  const result = await collectIncome(sql, user.id)

  // Only count toward challenge if income was >= 50% of daily cap
  if (result.passionGranted > 0 || result.coresGranted > 0) {
    const originalPassion = result.passionGranted + result.passionPending
    const originalCores = result.coresGranted + result.coresPending
    const halfFull = (result.passionCap > 0 && originalPassion >= result.passionCap * 0.5) ||
                     (result.coresCap > 0 && originalCores >= result.coresCap * 0.5)

    if (halfFull) {
      await ensureStats(sql, user.id)
      await sql`UPDATE cc_stats SET income_collections = income_collections + 1 WHERE user_id = ${user.id}`

      maybePushChallenges(sql, user.id)
    }
  }

  return formatS5Response(result, {
    passionGranted: result.passionGranted,
    coresGranted: result.coresGranted,
  })
}

// ═══ Card Signature ═══

async function handleRequestSignature(sql, user, body) {
  const { cardId } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }

  const [card] = await sql`
    SELECT c.id, c.owner_id, c.rarity, c.signature_url, c.def_id, d.player_id
    FROM cc_cards c
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    WHERE c.id = ${cardId}
  `
  if (!card) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Card not found' }) }
  if (card.owner_id !== user.id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not own this card' }) }
  if (card.rarity !== 'unique') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only unique cards can be signed' }) }
  if (card.signature_url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card is already signed' }) }
  if (!card.player_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only player cards can be signed' }) }

  // Check no existing pending request
  const [existing] = await sql`SELECT id FROM cc_signature_requests WHERE card_id = ${cardId}`
  if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Signature already requested' }) }

  await sql`
    INSERT INTO cc_signature_requests (card_id, requester_id, signer_player_id)
    VALUES (${cardId}, ${user.id}, ${card.player_id})
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handlePendingSignatures(sql, user) {
  if (!user.linked_player_id) {
    return { statusCode: 200, headers, body: JSON.stringify({ requests: [] }) }
  }

  const requests = await sql`
    SELECT sr.id, sr.card_id, sr.requester_id, sr.created_at,
           c.god_name, c.rarity, c.card_type, c.holo_type, c.holo_effect, c.image_url,
           c.card_data, c.def_id, c.role, c.god_class,
           d.player_name, d.team_name, d.team_color, d.role AS def_role,
           d.season_slug, d.league_slug, d.division_slug,
           u.discord_username AS requester_name
    FROM cc_signature_requests sr
    JOIN cc_cards c ON sr.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    LEFT JOIN users u ON sr.requester_id = u.id
    WHERE sr.signer_player_id = ${user.linked_player_id} AND sr.status = 'pending'
    ORDER BY sr.created_at DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      requests: requests.map(r => ({
        id: r.id,
        cardId: r.card_id,
        requesterId: r.requester_id,
        requesterName: r.requester_name,
        createdAt: r.created_at,
        cardType: r.card_type,
        godName: r.god_name,
        rarity: r.rarity,
        holoType: r.holo_type,
        holoEffect: r.holo_effect,
        imageUrl: r.image_url,
        role: r.def_role || r.role,
        godClass: r.god_class,
        cardData: r.card_data,
        defId: r.def_id,
        playerName: r.player_name,
        teamName: r.team_name,
        teamColor: r.team_color,
      })),
    }),
  }
}

async function handleDeclineSignature(sql, user, body) {
  const { requestId } = body
  if (!requestId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'requestId required' }) }
  if (!user.linked_player_id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a linked player' }) }

  const [req] = await sql`
    SELECT id, signer_player_id, status FROM cc_signature_requests WHERE id = ${requestId}
  `
  if (!req) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Request not found' }) }
  if (req.signer_player_id !== user.linked_player_id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your request' }) }
  if (req.status !== 'pending') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request is not pending' }) }

  await sql`UPDATE cc_signature_requests SET status = 'declined' WHERE id = ${requestId}`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handlePendingApprovalSignatures(sql, user) {
  const requests = await sql`
    SELECT sr.id, sr.card_id, sr.pending_signature_url, sr.signed_at,
           c.god_name, c.card_type, c.image_url, c.card_data, c.def_id, c.role, c.god_class,
           d.player_name, d.team_name, d.team_color
    FROM cc_signature_requests sr
    JOIN cc_cards c ON sr.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    WHERE c.owner_id = ${user.id} AND sr.status = 'awaiting_approval'
    ORDER BY sr.signed_at DESC
  `
  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      requests: requests.map(r => ({
        id: r.id, cardId: r.card_id, pendingSignatureUrl: r.pending_signature_url,
        signedAt: r.signed_at, godName: r.god_name, cardType: r.card_type,
        imageUrl: r.image_url, cardData: r.card_data, defId: r.def_id,
        role: r.role, godClass: r.god_class,
        playerName: r.player_name, teamName: r.team_name, teamColor: r.team_color,
      })),
    }),
  }
}

async function handleApproveSignature(sql, user, body) {
  const { requestId } = body
  if (!requestId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'requestId required' }) }

  const [req] = await sql`
    SELECT sr.id, sr.card_id, sr.status, sr.pending_signature_url, c.owner_id
    FROM cc_signature_requests sr
    JOIN cc_cards c ON sr.card_id = c.id
    WHERE sr.id = ${requestId}
  `
  if (!req) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Request not found' }) }
  if (req.owner_id !== user.id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your card' }) }
  if (req.status !== 'awaiting_approval') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Not awaiting approval' }) }

  await sql`UPDATE cc_cards SET signature_url = ${req.pending_signature_url} WHERE id = ${req.card_id}`
  await sql`UPDATE cc_signature_requests SET status = 'signed' WHERE id = ${requestId}`

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleRejectSignature(sql, user, body) {
  const { requestId } = body
  if (!requestId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'requestId required' }) }

  const [req] = await sql`
    SELECT sr.id, sr.card_id, sr.status, c.owner_id
    FROM cc_signature_requests sr
    JOIN cc_cards c ON sr.card_id = c.id
    WHERE sr.id = ${requestId}
  `
  if (!req) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Request not found' }) }
  if (req.owner_id !== user.id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your card' }) }
  if (req.status !== 'awaiting_approval') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Not awaiting approval' }) }

  // Reset to pending so the player can sign again
  await sql`UPDATE cc_signature_requests SET status = 'pending', pending_signature_url = NULL, signed_at = NULL WHERE id = ${requestId}`

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ Signed Unique Gallery (public) ═══

async function handleSignedUniqueGallery(sql) {
  const cards = await sql`
    SELECT c.*, sp.name AS passive_name,
           d.best_god_name, d.team_id, d.player_id AS def_player_id,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           ou.discord_username AS owner_name,
           sr.signed_at
    FROM cc_cards c
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN users ou ON c.owner_id = ou.id
    LEFT JOIN cc_signature_requests sr ON sr.card_id = c.id AND sr.status = 'signed'
    WHERE c.rarity = 'unique'
      AND c.signature_url IS NOT NULL
      AND c.god_id NOT LIKE 'test-sig-%'
    ORDER BY sr.signed_at DESC NULLS LAST, c.id DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      cards: cards.map(c => ({
        ...formatCard(c),
        ownerName: c.owner_name,
        signedAt: c.signed_at,
      })),
    }),
  }
}

// ═══ Collection Showcase (public) ═══

async function handleShowcaseCollection(sql, params) {
  const { slug } = params || {}
  if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Slug required' }) }

  const [collection] = await sql`
    SELECT id, name, description, cover_image_url, slug
    FROM cc_collections WHERE slug = ${slug} AND status = 'active'
  `
  if (!collection) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Collection not found' }) }

  const entries = await sql`
    SELECT e.id, e.blueprint_id,
           bp.name AS template_name,
           bp.card_type,
           bp.template_data,
           bp.thumbnail_url
    FROM cc_collection_entries e
    JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id
    WHERE e.collection_id = ${collection.id}
    ORDER BY e.added_at ASC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ collection, entries }),
  }
}

// ═══ Redeem Codes ═══

async function handleRedeemCode(sql, user, body) {
  const { code } = body
  if (!code || typeof code !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code required' }) }
  }

  const trimmed = code.trim().toUpperCase()
  const [row] = await sql`SELECT * FROM cc_redeem_codes WHERE UPPER(code) = ${trimmed} AND active = true`
  if (!row) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or expired code' }) }

  // Check expiration
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has expired' }) }
  }

  // Check max uses
  if (row.max_uses != null && row.times_redeemed >= row.max_uses) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has reached its redemption limit' }) }
  }

  // For per_person: check if user already redeemed
  if (row.mode === 'per_person') {
    const [existing] = await sql`SELECT id FROM cc_redeem_history WHERE code_id = ${row.id} AND user_id = ${user.id}`
    if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You have already redeemed this code' }) }
  }

  // For single: check not already used (belt-and-suspenders with active flag)
  if (row.mode === 'single' && row.times_redeemed > 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This code has already been used' }) }
  }

  const qty = row.quantity || 1

  // Add packs to inventory
  await sql`
    INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
    SELECT ${user.id}, ${row.pack_type_id}, 'redeem'
    FROM generate_series(1, ${qty})
  `

  // Record redemption
  await sql`INSERT INTO cc_redeem_history (code_id, user_id) VALUES (${row.id}, ${user.id})`
  await sql`UPDATE cc_redeem_codes SET times_redeemed = times_redeemed + 1 WHERE id = ${row.id}`

  // For single-use, deactivate
  if (row.mode === 'single') {
    await sql`UPDATE cc_redeem_codes SET active = false WHERE id = ${row.id}`
  }

  // Fetch pack name for response
  const [packType] = await sql`SELECT name FROM cc_pack_types WHERE id = ${row.pack_type_id}`

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: packType?.name || row.pack_type_id,
    packType: row.pack_type_id,
    quantity: qty,
    toInventory: true,
  }) }
}

async function handleAdminRedeemCodes(sql, event) {
  await requirePermission(event, 'permission_manage')

  const codes = await sql`
    SELECT c.*, u.discord_username AS creator_name,
           pt.name AS pack_name
    FROM cc_redeem_codes c
    LEFT JOIN users u ON u.id = c.created_by
    LEFT JOIN cc_pack_types pt ON pt.id = c.pack_type_id
    ORDER BY c.created_at DESC
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        packTypeId: c.pack_type_id,
        packName: c.pack_name,
        mode: c.mode,
        quantity: c.quantity || 1,
        maxUses: c.max_uses,
        expiresAt: c.expires_at,
        timesRedeemed: c.times_redeemed,
        active: c.active,
        creatorName: c.creator_name,
        createdAt: c.created_at,
      })),
    }),
  }
}

async function handleCreateRedeemCode(sql, event, body) {
  await requirePermission(event, 'permission_manage')
  const user = await requireAuth(event)

  const { code, packTypeId, mode, maxUses, expiresAt, quantity } = body
  if (!code || !packTypeId || !mode) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'code, packTypeId, and mode are required' }) }
  }
  if (!['single', 'per_person'].includes(mode)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'mode must be single or per_person' }) }
  }

  const qty = Math.max(1, Math.min(50, parseInt(quantity) || 1))

  // Verify pack type exists
  const [pack] = await sql`SELECT id FROM cc_pack_types WHERE id = ${packTypeId}`
  if (!pack) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack type not found' }) }

  // Check for duplicate code
  const trimmed = code.trim().toUpperCase()
  const [existing] = await sql`SELECT id FROM cc_redeem_codes WHERE UPPER(code) = ${trimmed}`
  if (existing) return { statusCode: 400, headers, body: JSON.stringify({ error: 'A code with this name already exists' }) }

  await sql`
    INSERT INTO cc_redeem_codes (code, pack_type_id, mode, max_uses, expires_at, quantity, created_by)
    VALUES (${code.trim()}, ${packTypeId}, ${mode}, ${maxUses || null}, ${expiresAt || null}, ${qty}, ${user.id})
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleToggleRedeemCode(sql, event, body) {
  await requirePermission(event, 'permission_manage')

  const { codeId, active } = body
  if (!codeId || typeof active !== 'boolean') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'codeId and active required' }) }
  }

  await sql`UPDATE cc_redeem_codes SET active = ${active} WHERE id = ${codeId}`
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ═══ Binder ═══

async function handleLoadBinder(sql, user) {
  const [binder] = await sql`
    SELECT * FROM cc_binders WHERE user_id = ${user.id}
  `
  const cards = await sql`
    SELECT bc.page, bc.slot, bc.card_id,
           c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.serial_number,
           c.holo_effect, c.holo_type, c.image_url, c.card_type, c.card_data,
           c.ability, c.metadata, c.def_id, c.is_first_edition, c.acquired_via, c.created_at,
           d.best_god_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           sp.name AS passive_name
    FROM cc_binder_cards bc
    JOIN cc_cards c ON bc.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE bc.user_id = ${user.id}
    ORDER BY bc.page, bc.slot
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      binder: binder ? { name: binder.name, color: binder.color, shareToken: binder.share_token } : null,
      cards: cards.map(c => ({
        page: c.page,
        slot: c.slot,
        card: formatCard(c),
      })),
    }),
  }
}

async function handleBinderView(sql, params) {
  const { token } = params || {}
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) }

  const [binder] = await sql`
    SELECT b.*, u.discord_username, u.discord_avatar, u.discord_id
    FROM cc_binders b
    JOIN users u ON b.user_id = u.id
    WHERE b.share_token = ${token}
  `
  if (!binder) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Binder not found' }) }

  const cards = await sql`
    SELECT bc.page, bc.slot,
           c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.serial_number,
           c.holo_effect, c.holo_type, c.image_url, c.card_type, c.card_data,
           c.ability, c.metadata, c.def_id, c.is_first_edition, c.acquired_via, c.created_at,
           c.blueprint_id,
           d.best_god_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           sp.name AS passive_name
    FROM cc_binder_cards bc
    JOIN cc_cards c ON bc.card_id = c.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    WHERE bc.user_id = ${binder.user_id}
    ORDER BY bc.page, bc.slot
  `

  // Inline blueprint data for blueprint-sourced cards in binder
  const bpBinder = cards.filter(c => c.blueprint_id)
  let binderBlueprintCache = {}
  if (bpBinder.length > 0) {
    const bids = [...new Set(bpBinder.map(c => c.blueprint_id))]
    const blueprints = await sql`
      SELECT id, card_type, template_data FROM cc_card_blueprints WHERE id = ANY(${bids})
    `
    for (const bp of blueprints) {
      const td = typeof bp.template_data === 'string' ? JSON.parse(bp.template_data) : bp.template_data
      binderBlueprintCache[bp.id] = { cardData: td?.cardData || {}, elements: td?.elements || [], border: td?.border || null, cardType: bp.card_type || 'custom' }
    }
  }

  const avatarUrl = binder.discord_id && binder.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${binder.discord_id}/${binder.discord_avatar}.webp?size=128`
    : null

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      binder: { name: binder.name, color: binder.color },
      owner: { username: binder.discord_username, avatar: avatarUrl },
      cards: cards.map(c => {
        if (c.blueprint_id && binderBlueprintCache[c.blueprint_id]) {
          const name = getBlueprintDisplayName(binderBlueprintCache[c.blueprint_id])
          if (name) c.god_name = name
        }
        const formatted = formatCard(c)
        if (c.blueprint_id && binderBlueprintCache[c.blueprint_id]) {
          formatted._blueprintData = binderBlueprintCache[c.blueprint_id]
        }
        return { page: c.page, slot: c.slot, card: formatted }
      }),
    }),
  }
}

async function handleBinderSave(sql, user, body) {
  const { name, color } = body
  if (!name || !color) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and color required' }) }

  const trimmedName = name.trim().slice(0, 40)
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8b5e3c'

  await sql`
    INSERT INTO cc_binders (user_id, name, color)
    VALUES (${user.id}, ${trimmedName}, ${safeColor})
    ON CONFLICT (user_id)
    DO UPDATE SET name = ${trimmedName}, color = ${safeColor}, updated_at = NOW()
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleBinderSlot(sql, user, body) {
  const { cardId, page, slot } = body
  if (!cardId || !page || !slot) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId, page, and slot required' }) }
  if (page < 1 || page > 10 || slot < 1 || slot > 9) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid page (1-10) or slot (1-9)' }) }
  }

  // Verify ownership
  const [card] = await sql`SELECT id FROM cc_cards WHERE id = ${cardId} AND owner_id = ${user.id}`
  if (!card) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card not found' }) }

  // Check card not locked elsewhere
  const [tradeLock] = await sql`
    SELECT tc.id FROM cc_trade_cards tc JOIN cc_trades t ON tc.trade_id = t.id
    WHERE tc.card_id = ${cardId} AND t.status IN ('waiting', 'active') AND t.mode = 'direct' LIMIT 1
  `
  if (tradeLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card is in an active trade' }) }

  const [marketLock] = await sql`
    SELECT id FROM cc_market_listings WHERE card_id = ${cardId} AND status = 'active' LIMIT 1
  `
  if (marketLock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card is listed on the marketplace' }) }

  const [s5Lock] = await sql`
    SELECT role FROM cc_lineups
    WHERE (card_id = ${cardId} OR god_card_id = ${cardId} OR item_card_id = ${cardId}) AND user_id = ${user.id}
  `
  if (s5Lock) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Card is in your Starting 5 lineup' }) }

  // Ensure binder exists
  await sql`
    INSERT INTO cc_binders (user_id) VALUES (${user.id})
    ON CONFLICT (user_id) DO NOTHING
  `

  // Remove card from any existing binder slot first
  await sql`DELETE FROM cc_binder_cards WHERE card_id = ${cardId}`

  // Slot the card (upsert — replaces whatever was in this page/slot)
  await sql`
    INSERT INTO cc_binder_cards (user_id, card_id, page, slot)
    VALUES (${user.id}, ${cardId}, ${page}, ${slot})
    ON CONFLICT (user_id, page, slot)
    DO UPDATE SET card_id = ${cardId}, slotted_at = NOW()
  `

  // Auto-remove from trade pile when slotted into binder
  await sql`DELETE FROM cc_trade_pile WHERE card_id = ${cardId}`

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleBinderUnslot(sql, user, body) {
  const { page, slot } = body
  if (!page || !slot) return { statusCode: 400, headers, body: JSON.stringify({ error: 'page and slot required' }) }

  await sql`
    DELETE FROM cc_binder_cards
    WHERE user_id = ${user.id} AND page = ${page} AND slot = ${slot}
  `

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function handleBinderGenerateShare(sql, user, event) {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

  await sql`
    INSERT INTO cc_binders (user_id, share_token) VALUES (${user.id}, ${token})
    ON CONFLICT (user_id)
    DO UPDATE SET share_token = ${token}, updated_at = NOW()
  `

  return { statusCode: 200, headers, body: JSON.stringify({ shareToken: token }) }
}

// ═══ Unique Cards: Holo Type ═══

async function handleChangeHoloType(sql, user, body) {
  const { cardId, holoType } = body
  if (!cardId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId required' }) }
  const validTypes = ['holo', 'reverse', 'full']
  if (!validTypes.includes(holoType)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'holoType must be holo, reverse, or full' }) }

  const [card] = await sql`
    SELECT id, owner_id, rarity, holo_type FROM cc_cards WHERE id = ${cardId}
  `
  if (!card) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Card not found' }) }
  if (card.owner_id !== user.id) return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not own this card' }) }
  if (card.rarity !== 'unique') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only unique cards can change holo type' }) }

  await sql`UPDATE cc_cards SET holo_type = ${holoType} WHERE id = ${cardId}`

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, holoType }) }
}

// ═══ POST: Send promo gift (owner only) ═══
async function handleSendPromoGift(sql, user, body, event) {
  const owner = await requirePermission(event, 'permission_manage')
  if (!owner) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Owner only' }) }

  const { recipientId, cardType, rarity, blueprintId, cardConfig, message, tradeable = true } = body
  if (!recipientId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'recipientId required' }) }
  if (!cardType) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardType required' }) }
  if (!rarity) return { statusCode: 400, headers, body: JSON.stringify({ error: 'rarity required' }) }
  if (!cardConfig || typeof cardConfig !== 'object') return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardConfig required' }) }

  const validTypes = ['god', 'item', 'player', 'staff', 'custom', 'consumable', 'minion', 'buff']
  if (!validTypes.includes(cardType)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid cardType' }) }

  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique', 'full_art']
  if (!validRarities.includes(rarity)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid rarity' }) }

  const [recipient] = await sql`SELECT id FROM users WHERE id = ${recipientId}`
  if (!recipient) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Recipient not found' }) }

  if (body.blueprintId) {
    const [bp] = await sql`SELECT id FROM cc_card_blueprints WHERE id = ${body.blueprintId} AND status = 'approved'`
    if (!bp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Blueprint not found or not approved' }) }
  }

  const trimmedMsg = message ? String(message).trim().slice(0, 500) : null

  const [gift] = await sql`
    INSERT INTO cc_promo_gifts (recipient_id, card_type, rarity, blueprint_id, card_config, message, tradeable, created_by)
    VALUES (${recipientId}, ${cardType}, ${rarity}, ${blueprintId || null}, ${JSON.stringify(cardConfig)}, ${trimmedMsg}, ${tradeable !== false}, ${user.id})
    RETURNING id
  `

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, giftId: gift.id }),
  }
}

// ═══ POST: Claim promo gift ═══
async function handleClaimPromoGift(sql, user, body) {
  const { giftId } = body
  if (!giftId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'giftId required' }) }

  const card = await transaction(async (tx) => {
    const [gift] = await tx`
      SELECT * FROM cc_promo_gifts
      WHERE id = ${giftId} AND recipient_id = ${user.id} AND claimed = false
      FOR UPDATE
    `
    if (!gift) return null

    const config = typeof gift.card_config === 'string' ? JSON.parse(gift.card_config) : gift.card_config

    // Resolve player def data at claim time for fresh stats + avatar
    if (gift.card_type === 'player' && config.def_id) {
      const [def] = await tx`SELECT * FROM cc_player_defs WHERE id = ${config.def_id}`
      if (!def) {
        config.god_id = config.god_id || `player-def-${config.def_id}`
      } else {
        const stats = def.frozen_stats || await computePlayerStats(tx, def.player_id, def.team_id, def.season_id)
        config.god_id = `player-${def.player_id}-t${def.team_id}`
        config.god_name = def.player_name
        config.god_class = (def.role || 'adc').toUpperCase()
        config.role = (def.role || 'adc').toLowerCase()
        config.card_data = {
          defId: def.id,
          playerId: def.player_id,
          teamName: def.team_name,
          teamColor: def.team_color || '#6366f1',
          seasonName: def.season_slug,
          leagueName: def.league_slug,
          divisionName: def.division_slug,
          role: (def.role || 'adc').toUpperCase(),
          stats,
          bestGod: stats.bestGod,
        }
        const [prefRow] = await tx`
          SELECT u.discord_id, u.discord_avatar, COALESCE(up.allow_discord_avatar, true) AS allow_avatar
          FROM users u LEFT JOIN user_preferences up ON up.user_id = u.id
          WHERE u.linked_player_id = ${def.player_id}
        `
        if (prefRow?.allow_avatar && prefRow.discord_id && prefRow.discord_avatar) {
          config.image_url = `https://cdn.discordapp.com/avatars/${prefRow.discord_id}/${prefRow.discord_avatar}.webp?size=256`
        }
      }
    }

    const holoEffect = rollHoloEffect(gift.rarity)
    const holoType = rollHoloType(gift.rarity)
    const serialNumber = Math.floor(Math.random() * 9999) + 1

    const isFirstEdition = false

    let passiveId = null
    let passiveName = null
    if (gift.card_type === 'staff') {
      const passives = await tx`SELECT id, name FROM cc_staff_passives`
      if (passives.length > 0) {
        const picked = passives[Math.floor(Math.random() * passives.length)]
        passiveId = picked.id
        passiveName = picked.name
      }
    }

    const [c] = await tx`
      INSERT INTO cc_cards (
        owner_id, original_owner_id, god_id, god_name, god_class, role, rarity,
        serial_number, holo_effect, holo_type, image_url, acquired_via, card_type,
        card_data, def_id, blueprint_id, is_first_edition, depicted_user_id, trade_locked, passive_id
      ) VALUES (
        ${user.id}, ${user.id}, ${config.god_id || null}, ${config.god_name || null},
        ${config.god_class || null}, ${config.role || null}, ${gift.rarity},
        ${serialNumber}, ${holoEffect}, ${holoType},
        ${config.image_url || null}, 'gift', ${gift.card_type},
        ${JSON.stringify(config.card_data || {})}, ${config.def_id || null},
        ${gift.blueprint_id || null}, ${isFirstEdition},
        ${config.depicted_user_id || null}, ${!gift.tradeable}, ${passiveId}
      )
      RETURNING *
    `
    c.passive_name = passiveName

    await tx`
      UPDATE cc_promo_gifts
      SET claimed = true, claimed_at = NOW(), card_id = ${c.id}
      WHERE id = ${giftId}
    `

    return { card: c, message: gift.message }
  })
  if (!card) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gift not found or already claimed' }) }

  const formatted = [formatCard(card.card)]
  await inlineBlueprintData(sql, formatted)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      card: formatted[0],
      packName: 'Special Promo Gift Pack',
      message: card.message,
    }),
  }
}

// ═══ Formatters ═══
function getBlueprintDisplayName(bpData) {
  if (bpData.cardData?.name) return bpData.cardData.name
  if (bpData.elements?.length > 0) {
    const banner = bpData.elements.find(el => el.type === 'name-banner')
    if (banner?.playerName) return banner.playerName
  }
  return null
}

function formatCard(row) {
  return {
    id: row.id,
    godId: row.god_id,
    godName: row.god_name,
    godClass: row.god_class,
    role: row.role,
    rarity: row.rarity,
    power: row.power,
    level: row.level,
    xp: row.xp,
    serialNumber: row.serial_number,
    holoEffect: row.holo_effect,
    holoType: row.holo_type,
    imageUrl: row.card_type === 'player'
      ? ('player_discord_id' in row
        ? (row.allow_discord_avatar && row.player_discord_id && row.player_discord_avatar
          ? `https://cdn.discordapp.com/avatars/${row.player_discord_id}/${row.player_discord_avatar}.webp?size=256`
          : '')
        : (row.image_url || ''))
      : row.image_url,
    ability: row.ability,
    metadata: row.metadata || {},
    acquiredVia: row.acquired_via,
    acquiredAt: row.created_at,
    cardType: row.card_type || 'god',
    cardData: row.card_data || null,
    defId: row.def_id || null,
    isFirstEdition: row.is_first_edition || false,
    isConnected: row.card_data?.isConnected ?? null,
    bestGodName: row.best_god_name || null,
    bestGodFull: row._bestGodFull || null,
    teamId: row.team_id || row.card_data?.teamId || null,
    defPlayerId: row.def_player_id || null,
    signatureUrl: row.signature_url || null,
    blueprintId: row.blueprint_id || null,
    tradeLocked: row.trade_locked || false,
    passiveName: row.passive_name || null,
  }
}

function formatStats(row) {
  if (!row) return { packsOpened: 0, embers: 0, brudihsTurnedIn: 0, pendingMythicClaim: 0, dismantledToday: 0, dismantledValueToday: 0 }
  const today = new Date().toISOString().slice(0, 10)
  const isToday = row.dismantle_reset_date === today
  const dismantledToday = isToday ? (row.dismantled_today || 0) : 0
  const dismantledValueToday = isToday ? (parseFloat(row.dismantled_value_today) || 0) : 0
  return {
    packsOpened: row.packs_opened,
    embers: row.embers,
    brudihsTurnedIn: row.brudihs_turned_in || 0,
    pendingMythicClaim: row.pending_mythic_claim || 0,
    dismantledToday,
    dismantledValueToday,
  }
}

export const onRequest = adapt(handler)

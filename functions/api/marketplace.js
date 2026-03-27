// Card Clash Marketplace API — Core-only, browse/list/buy/cancel
import { adapt } from '../lib/adapter.js'
import { getDB, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { createListing, cancelListing, buyListing, MARKET_RULES, calculateFee } from '../lib/marketplace.js'
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
        case 'list': return await handleList(sql, event.queryStringParameters)
        case 'my-listings': return await handleMyListings(sql, user)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create': return await handleCreate(sql, user, body)
        case 'buy': return await handleBuy(sql, user, body)
        case 'cancel': return await handleCancel(sql, user, body)
        default: return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('marketplace error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Browse listings ═══
async function handleList(sql, params) {
  const {
    page = '0', limit = '24', sort = 'newest',
    rarity, cardType, search, minPrice, maxPrice, holoType, role,
    itemType,
  } = params

  const offset = parseInt(page) * parseInt(limit)
  const lim = Math.min(parseInt(limit), 50)

  const rows = await sql`
    SELECT l.id, l.seller_id, l.card_id, l.core_price, l.created_at, l.item_type, l.pack_inventory_id,
           c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url, c.blueprint_id,
           sp.name AS passive_name,
           d.best_god_name,
           u.discord_username AS seller_name, u.discord_avatar AS seller_avatar, u.discord_id AS seller_discord_id,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           pt.name AS pack_name, pt.cards_per_pack, pt.category AS pack_category, pt.color AS pack_color,
           pi.pack_type_id
    FROM cc_market_listings l
    LEFT JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_pack_inventory pi ON l.pack_inventory_id = pi.id
    LEFT JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active'
    ORDER BY l.created_at DESC
  `

  let filtered = Array.from(rows)

  if (itemType === 'card' || itemType === 'pack') {
    filtered = filtered.filter(l => l.item_type === itemType)
  }
  if (rarity) {
    const rarities = rarity.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && rarities.includes(l.rarity))
  }
  if (cardType) {
    const types = cardType.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && types.includes(l.card_type))
  }
  if (holoType) {
    const types = holoType.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && l.holo_type && types.includes(l.holo_type))
  }
  if (role) {
    const roles = role.split(',')
    filtered = filtered.filter(l => l.item_type === 'card' && l.role && roles.includes(l.role))
  }
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(l =>
      (l.item_type === 'card' && l.god_name?.toLowerCase().includes(q)) ||
      (l.item_type === 'pack' && l.pack_name?.toLowerCase().includes(q))
    )
  }
  if (minPrice) {
    filtered = filtered.filter(l => l.core_price >= parseInt(minPrice))
  }
  if (maxPrice) {
    filtered = filtered.filter(l => l.core_price <= parseInt(maxPrice))
  }

  const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6 }
  const packSortEnd = 99
  switch (sort) {
    case 'price_asc': filtered.sort((a, b) => a.core_price - b.core_price); break
    case 'price_desc': filtered.sort((a, b) => b.core_price - a.core_price); break
    case 'rarity_asc': filtered.sort((a, b) => (rarityOrder[a.rarity] ?? packSortEnd) - (rarityOrder[b.rarity] ?? packSortEnd)); break
    case 'rarity_desc': filtered.sort((a, b) => (rarityOrder[b.rarity] ?? packSortEnd) - (rarityOrder[a.rarity] ?? packSortEnd)); break
    case 'oldest': filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break
    default: break
  }

  const total = filtered.length
  const pageItems = filtered.slice(offset, offset + lim)
  const listings = pageItems.map(formatListing)
  await embedBlueprints(sql, listings)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      listings,
      total,
      page: parseInt(page),
      limit: lim,
    }),
  }
}

// ═══ GET: My listings ═══
async function handleMyListings(sql, user) {
  const rows = await sql`
    SELECT l.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.holo_type, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id, c.signature_url, c.blueprint_id,
           sp.name AS passive_name,
           d.best_god_name,
           bu.discord_username AS buyer_name,
           pu.discord_id AS player_discord_id, pu.discord_avatar AS player_discord_avatar,
           COALESCE(pup.allow_discord_avatar, true) AS allow_discord_avatar,
           pt.name AS pack_name, pt.cards_per_pack, pt.category AS pack_category, pt.color AS pack_color,
           pi.pack_type_id
    FROM cc_market_listings l
    LEFT JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN cc_staff_passives sp ON c.passive_id = sp.id
    LEFT JOIN cc_player_defs d ON c.def_id = d.id AND c.card_type = 'player'
    LEFT JOIN LATERAL (
      SELECT u.id, u.discord_id, u.discord_avatar
      FROM users u WHERE u.linked_player_id = d.player_id LIMIT 1
    ) pu ON true
    LEFT JOIN user_preferences pup ON pup.user_id = pu.id
    LEFT JOIN cc_pack_inventory pi ON l.pack_inventory_id = pi.id
    LEFT JOIN cc_pack_types pt ON pi.pack_type_id = pt.id
    LEFT JOIN users bu ON l.buyer_id = bu.id
    WHERE l.seller_id = ${user.id}
    ORDER BY
      CASE l.status WHEN 'active' THEN 0 WHEN 'sold' THEN 1 ELSE 2 END,
      l.created_at DESC
  `

  const listings = Array.from(rows)
  const activeCards = listings.filter(l => l.status === 'active' && l.item_type === 'card').length
  const activePacks = listings.filter(l => l.status === 'active' && l.item_type === 'pack').length

  const formatted = listings.map(l => ({
    ...formatListing(l),
    status: l.status,
    buyerName: l.buyer_name || null,
    soldAt: l.sold_at,
  }))
  await embedBlueprints(sql, formatted)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      listings: formatted,
      activeCardCount: activeCards,
      activePackCount: activePacks,
      maxCardListings: MARKET_RULES.max_card_listings_per_user,
      maxPackListings: MARKET_RULES.max_pack_listings_per_user,
    }),
  }
}

// ═══ POST: Create listing ═══
async function handleCreate(sql, user, body) {
  const { cardId, packInventoryId, price } = body
  if (!cardId && !packInventoryId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId or packInventoryId required' }) }
  }
  if (cardId && packInventoryId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide cardId or packInventoryId, not both' }) }
  }
  const parsedPrice = parseInt(price)
  if (!parsedPrice || parsedPrice < 1 || parsedPrice > 10000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Price must be between 1 and 10,000' }) }
  }

  const listing = await createListing(sql, user.id, { cardId, packInventoryId, price: parsedPrice })

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ listing: { id: listing.id, status: listing.status } }),
  }
}

// ═══ POST: Buy listing ═══
async function handleBuy(sql, user, body) {
  const { listingId } = body
  if (!listingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'listingId required' }) }
  }

  const result = await transaction(async (tx) => {
    return await buyListing(tx, user.id, listingId)
  })

  // Push vault challenge progress for buyer and seller (fire-and-forget)
  const pushForUser = (uid) =>
    getVaultStats(sql, uid)
      .then(stats => pushChallengeProgress(sql, uid, stats))
      .catch(err => console.error('Vault challenge push (marketplace) failed:', err))
  pushForUser(user.id)
  if (result.listing?.seller_id) pushForUser(result.listing.seller_id)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      success: true,
      price: result.price,
      fee: result.fee,
    }),
  }
}

// ═══ POST: Cancel listing ═══
async function handleCancel(sql, user, body) {
  const { listingId } = body
  if (!listingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'listingId required' }) }
  }

  await cancelListing(sql, user.id, listingId)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true }),
  }
}

// ═══ Blueprint embedding ═══
async function embedBlueprints(sql, listings) {
  const bids = [...new Set(
    listings.filter(l => l.card?.blueprintId).map(l => l.card.blueprintId)
  )]
  if (bids.length === 0) return
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
  for (const l of listings) {
    if (l.card?.blueprintId && cache[l.card.blueprintId]) {
      const bpData = cache[l.card.blueprintId]
      l.card._blueprintData = bpData
      const name = getBlueprintDisplayName(bpData)
      if (name) l.card.godName = name
    }
  }
}

function getBlueprintDisplayName(bpData) {
  if (bpData.cardData?.name) return bpData.cardData.name
  if (bpData.elements?.length > 0) {
    const banner = bpData.elements.find(el => el.type === 'name-banner')
    if (banner?.playerName) return banner.playerName
  }
  return null
}

// ═══ Formatters ═══
function formatListing(row) {
  const base = {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || null,
    sellerAvatar: row.seller_discord_id && row.seller_avatar
      ? `https://cdn.discordapp.com/avatars/${row.seller_discord_id}/${row.seller_avatar}.webp?size=64`
      : null,
    price: row.core_price,
    createdAt: row.created_at,
    itemType: row.item_type,
  }

  if (row.item_type === 'pack') {
    return {
      ...base,
      packInventoryId: row.pack_inventory_id,
      pack: {
        packTypeId: row.pack_type_id,
        name: row.pack_name,
        cardsPerPack: row.cards_per_pack,
        category: row.pack_category,
        color: row.pack_color || null,
      },
    }
  }

  return {
    ...base,
    cardId: row.card_id,
    card: {
      godId: row.god_id,
      godName: row.god_name,
      godClass: row.god_class,
      role: row.role,
      rarity: row.rarity,
      holoEffect: row.holo_effect,
      holoType: row.holo_type,
      imageUrl: row.card_type === 'player'
        ? (row.allow_discord_avatar && row.player_discord_id && row.player_discord_avatar
          ? `https://cdn.discordapp.com/avatars/${row.player_discord_id}/${row.player_discord_avatar}.webp?size=256`
          : '')
        : row.image_url,
      cardType: row.card_type,
      cardData: row.card_data,
      serialNumber: row.serial_number,
      defId: row.def_id,
      isConnected: row.card_data?.isConnected ?? null,
      bestGodName: row.best_god_name || null,
      signatureUrl: row.signature_url || null,
      blueprintId: row.blueprint_id || null,
      passiveName: row.passive_name || null,
    },
  }
}

export const onRequest = adapt(handler)

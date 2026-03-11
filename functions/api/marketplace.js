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
    rarity, cardType, search, minPrice, maxPrice,
  } = params

  const offset = parseInt(page) * parseInt(limit)
  const lim = Math.min(parseInt(limit), 50)

  const rows = await sql`
    SELECT l.id, l.seller_id, l.card_id, l.core_price, l.created_at,
           c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id,
           u.discord_username AS seller_name, u.discord_avatar AS seller_avatar, u.discord_id AS seller_discord_id
    FROM cc_market_listings l
    JOIN cc_cards c ON l.card_id = c.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active'
    ORDER BY l.created_at DESC
  `

  let filtered = Array.from(rows)

  if (rarity) {
    const rarities = rarity.split(',')
    filtered = filtered.filter(l => rarities.includes(l.rarity))
  }
  if (cardType) {
    const types = cardType.split(',')
    filtered = filtered.filter(l => types.includes(l.card_type))
  }
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(l => l.god_name.toLowerCase().includes(q))
  }
  if (minPrice) {
    filtered = filtered.filter(l => l.core_price >= parseInt(minPrice))
  }
  if (maxPrice) {
    filtered = filtered.filter(l => l.core_price <= parseInt(maxPrice))
  }

  const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }
  switch (sort) {
    case 'price_asc': filtered.sort((a, b) => a.core_price - b.core_price); break
    case 'price_desc': filtered.sort((a, b) => b.core_price - a.core_price); break
    case 'rarity_asc': filtered.sort((a, b) => (rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0)); break
    case 'rarity_desc': filtered.sort((a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)); break
    case 'oldest': filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break
    default: break
  }

  const total = filtered.length
  const pageItems = filtered.slice(offset, offset + lim)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      listings: pageItems.map(formatListing),
      total,
      page: parseInt(page),
      limit: lim,
    }),
  }
}

// ═══ GET: My listings ═══
async function handleMyListings(sql, user) {
  const rows = await sql`
    SELECT l.*, c.god_id, c.god_name, c.god_class, c.role, c.rarity, c.holo_effect, c.image_url,
           c.card_type, c.card_data, c.serial_number, c.def_id,
           bu.discord_username AS buyer_name
    FROM cc_market_listings l
    JOIN cc_cards c ON l.card_id = c.id
    LEFT JOIN users bu ON l.buyer_id = bu.id
    WHERE l.seller_id = ${user.id}
    ORDER BY
      CASE l.status WHEN 'active' THEN 0 WHEN 'sold' THEN 1 ELSE 2 END,
      l.created_at DESC
  `

  const listings = Array.from(rows)

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      listings: listings.map(l => ({
        ...formatListing(l),
        status: l.status,
        buyerName: l.buyer_name || null,
        soldAt: l.sold_at,
      })),
      activeCount: listings.filter(l => l.status === 'active').length,
      maxListings: MARKET_RULES.max_listings_per_user,
    }),
  }
}

// ═══ POST: Create listing ═══
async function handleCreate(sql, user, body) {
  const { cardId, price } = body
  if (!cardId || !price) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardId and price required' }) }
  }
  const parsedPrice = parseInt(price)
  if (parsedPrice < 1 || parsedPrice > 10000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Price must be between 1 and 10,000' }) }
  }

  const listing = await createListing(sql, user.id, { cardId, price: parsedPrice })

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

// ═══ Formatters ═══
function formatListing(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || null,
    sellerAvatar: row.seller_discord_id && row.seller_avatar
      ? `https://cdn.discordapp.com/avatars/${row.seller_discord_id}/${row.seller_avatar}.webp?size=64`
      : null,
    cardId: row.card_id,
    price: row.core_price,
    createdAt: row.created_at,
    card: {
      godId: row.god_id,
      godName: row.god_name,
      godClass: row.god_class,
      role: row.role,
      rarity: row.rarity,
      holoEffect: row.holo_effect,
      imageUrl: row.image_url,
      cardType: row.card_type,
      cardData: row.card_data,
      serialNumber: row.serial_number,
      defId: row.def_id,
    },
  }
}

export const onRequest = adapt(handler)

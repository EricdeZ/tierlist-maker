// Vending Restock Admin API — manage cc_pack_sales listings
// Permission: permission_manage (global only)

import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: adminHeaders, body: '' }
  }

  const user = await requirePermission(event, 'permission_manage')
  if (!user) {
    return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  try {
    if (event.httpMethod === 'GET') {
      switch (action) {
        case 'load': return await handleLoad(sql)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      switch (action) {
        case 'create':  return await handleCreate(sql, body)
        case 'restock': return await handleRestock(sql, body)
        case 'edit':    return await handleEdit(sql, body)
        case 'toggle':  return await handleToggle(sql, body)
        case 'delete':  return await handleDelete(sql, body)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('vending-restock error:', error)
    return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load all sales + pack types ═══
async function handleLoad(sql) {
  const [sales, packTypes] = await Promise.all([
    sql`
      SELECT s.*, pt.name AS base_name, pt.description AS base_description,
             pt.cards_per_pack, pt.category, pt.league_id, pt.cost AS base_cost
      FROM cc_pack_sales s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      ORDER BY s.active DESC, s.sort_order, s.created_at DESC
    `,
    sql`SELECT * FROM cc_pack_types WHERE enabled = true ORDER BY sort_order`,
  ])

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      sales: sales.map(formatSale),
      packTypes: packTypes.map(p => ({
        id: p.id,
        name: p.name,
        cost: p.cost,
        cards: p.cards_per_pack,
        category: p.category,
        leagueId: p.league_id,
      })),
    }),
  }
}

// ═══ POST: Create new sale listing ═══
async function handleCreate(sql, body) {
  const { packTypeId, price, stock, name, sortOrder } = body
  if (!packTypeId || !stock) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'packTypeId and stock required' }) }
  }

  // Look up default price from pack type if not provided
  let salePrice = price
  if (salePrice == null) {
    const [pt] = await sql`SELECT cost FROM cc_pack_types WHERE id = ${packTypeId}`
    if (!pt) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type not found' }) }
    salePrice = pt.cost
  }

  const [sale] = await sql`
    INSERT INTO cc_pack_sales (pack_type_id, name, price, stock, initial_stock, sort_order, active)
    VALUES (${packTypeId}, ${name || null}, ${salePrice}, ${stock}, ${stock}, ${sortOrder || 0}, true)
    RETURNING *
  `

  // Re-fetch with join for full data
  const [full] = await sql`
    SELECT s.*, pt.name AS base_name, pt.description AS base_description,
           pt.cards_per_pack, pt.category, pt.league_id, pt.cost AS base_cost
    FROM cc_pack_sales s
    JOIN cc_pack_types pt ON s.pack_type_id = pt.id
    WHERE s.id = ${sale.id}
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ sale: formatSale(full) }) }
}

// ═══ POST: Restock an existing listing ═══
async function handleRestock(sql, body) {
  const { id, amount } = body
  if (!id || !amount || amount < 1) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id and positive amount required' }) }
  }

  const [updated] = await sql`
    UPDATE cc_pack_sales
    SET stock = stock + ${amount}, initial_stock = initial_stock + ${amount}
    WHERE id = ${id}
    RETURNING *
  `
  if (!updated) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Sale not found' }) }

  const [full] = await sql`
    SELECT s.*, pt.name AS base_name, pt.description AS base_description,
           pt.cards_per_pack, pt.category, pt.league_id, pt.cost AS base_cost
    FROM cc_pack_sales s
    JOIN cc_pack_types pt ON s.pack_type_id = pt.id
    WHERE s.id = ${id}
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ sale: formatSale(full) }) }
}

// ═══ POST: Edit a listing's name, price, or sort order ═══
async function handleEdit(sql, body) {
  const { id, name, price, sortOrder } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [updated] = await sql`
    UPDATE cc_pack_sales
    SET name = ${name || null},
        price = COALESCE(${price != null ? price : null}, price),
        sort_order = COALESCE(${sortOrder != null ? sortOrder : null}, sort_order)
    WHERE id = ${id}
    RETURNING *
  `
  if (!updated) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Sale not found' }) }

  const [full] = await sql`
    SELECT s.*, pt.name AS base_name, pt.description AS base_description,
           pt.cards_per_pack, pt.category, pt.league_id, pt.cost AS base_cost
    FROM cc_pack_sales s
    JOIN cc_pack_types pt ON s.pack_type_id = pt.id
    WHERE s.id = ${id}
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ sale: formatSale(full) }) }
}

// ═══ POST: Toggle active state ═══
async function handleToggle(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [updated] = await sql`
    UPDATE cc_pack_sales SET active = NOT active WHERE id = ${id}
    RETURNING *
  `
  if (!updated) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Sale not found' }) }

  const [full] = await sql`
    SELECT s.*, pt.name AS base_name, pt.description AS base_description,
           pt.cards_per_pack, pt.category, pt.league_id, pt.cost AS base_cost
    FROM cc_pack_sales s
    JOIN cc_pack_types pt ON s.pack_type_id = pt.id
    WHERE s.id = ${id}
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ sale: formatSale(full) }) }
}

// ═══ POST: Delete a listing ═══
async function handleDelete(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  await sql`DELETE FROM cc_pack_sales WHERE id = ${id}`
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ deleted: true }) }
}

function formatSale(row) {
  return {
    id: row.id,
    packTypeId: row.pack_type_id,
    name: row.name || row.base_name,
    baseName: row.base_name,
    price: row.price,
    baseCost: row.base_cost,
    stock: row.stock,
    initialStock: row.initial_stock,
    cards: row.cards_per_pack,
    category: row.category,
    leagueId: row.league_id,
    sortOrder: row.sort_order,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  }
}

export const onRequest = adapt(handler)

// Pack Creator Admin API — CRUD for cc_pack_types with slot configuration
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
        case 'update':  return await handleUpdate(sql, body)
        case 'toggle':  return await handleToggle(sql, body)
        case 'delete':  return await handleDelete(sql, body)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('pack-creator error:', error)
    return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load all pack types + divisions for picker ═══
async function handleLoad(sql) {
  const [packTypes, divisions] = await Promise.all([
    sql`SELECT * FROM cc_pack_types ORDER BY sort_order, created_at`,
    sql`
      SELECT d.id, d.name, d.tier, d.slug, l.id AS league_id, l.name AS league_name, l.slug AS league_slug
      FROM divisions d
      JOIN leagues l ON l.id = d.league_id
      ORDER BY l.name, d.tier, d.name
    `,
  ])

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      packTypes: packTypes.map(formatPackType),
      divisions: divisions.map(d => ({
        id: d.id,
        name: d.name,
        tier: d.tier,
        slug: d.slug,
        leagueId: d.league_id,
        leagueName: d.league_name,
        leagueSlug: d.league_slug,
      })),
    }),
  }
}

// ═══ POST: Create new pack type ═══
async function handleCreate(sql, body) {
  const { id, name, description, cost, cardsPerPack, category, slots, divisionIds, color, guarantees, groupConstraints, sortOrder } = body
  if (!id || !name) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id and name required' }) }
  }

  if (!/^[a-z0-9-]+$/.test(id)) {
    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id must be lowercase alphanumeric with dashes' }) }
  }

  const [existing] = await sql`SELECT 1 FROM cc_pack_types WHERE id = ${id}`
  if (existing) {
    return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type ID already exists' }) }
  }

  const [row] = await sql`
    INSERT INTO cc_pack_types (id, name, description, cost, cards_per_pack, category, guarantees, slots, division_ids, color, group_constraints, sort_order, enabled)
    VALUES (
      ${id}, ${name}, ${description || null}, ${cost || 0},
      ${slots?.length || cardsPerPack || 6}, ${category || 'configured'},
      ${guarantees ? JSON.stringify(guarantees) : '[]'},
      ${slots ? JSON.stringify(slots) : null},
      ${divisionIds?.length ? divisionIds : null},
      ${color || null},
      ${groupConstraints && Object.keys(groupConstraints).length > 0 ? JSON.stringify(groupConstraints) : null},
      ${sortOrder || 0}, false
    )
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Update existing pack type ═══
async function handleUpdate(sql, body) {
  const { id, name, description, cost, cardsPerPack, category, slots, divisionIds, color, guarantees, groupConstraints, sortOrder } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [existing] = await sql`SELECT * FROM cc_pack_types WHERE id = ${id}`
  if (!existing) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type not found' }) }

  const [row] = await sql`
    UPDATE cc_pack_types SET
      name = ${name || existing.name},
      description = ${description !== undefined ? description : existing.description},
      cost = ${cost != null ? cost : existing.cost},
      cards_per_pack = ${slots?.length || cardsPerPack || existing.cards_per_pack},
      category = ${category || existing.category},
      guarantees = ${guarantees ? JSON.stringify(guarantees) : (existing.guarantees ? JSON.stringify(existing.guarantees) : '[]')},
      slots = ${slots ? JSON.stringify(slots) : (slots === null ? null : existing.slots ? JSON.stringify(existing.slots) : null)},
      division_ids = ${divisionIds !== undefined ? (divisionIds?.length ? divisionIds : null) : existing.division_ids},
      color = ${color !== undefined ? color : existing.color},
      group_constraints = ${groupConstraints !== undefined ? (groupConstraints && Object.keys(groupConstraints).length > 0 ? JSON.stringify(groupConstraints) : null) : (existing.group_constraints ? JSON.stringify(existing.group_constraints) : null)},
      sort_order = ${sortOrder != null ? sortOrder : existing.sort_order}
    WHERE id = ${id}
    RETURNING *
  `

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Toggle enabled ═══
async function handleToggle(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [row] = await sql`
    UPDATE cc_pack_types SET enabled = NOT enabled WHERE id = ${id} RETURNING *
  `
  if (!row) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Pack type not found' }) }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ packType: formatPackType(row) }) }
}

// ═══ POST: Delete ═══
async function handleDelete(sql, body) {
  const { id } = body
  if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }

  const [hasSales] = await sql`SELECT 1 FROM cc_pack_sales WHERE pack_type_id = ${id} LIMIT 1`
  if (hasSales) {
    return { statusCode: 409, headers: adminHeaders, body: JSON.stringify({ error: 'Cannot delete pack type that has sale listings. Remove sales first.' }) }
  }

  await sql`DELETE FROM cc_pack_types WHERE id = ${id}`
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ deleted: true }) }
}

function formatPackType(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cost: row.cost,
    cardsPerPack: row.cards_per_pack,
    category: row.category,
    guarantees: row.guarantees || [],
    slots: row.slots || null,
    divisionIds: row.division_ids || [],
    leagueId: row.league_id,
    color: row.color,
    groupConstraints: row.group_constraints || {},
    sortOrder: row.sort_order,
    enabled: row.enabled,
    createdAt: row.created_at,
  }
}

export const onRequest = adapt(handler)

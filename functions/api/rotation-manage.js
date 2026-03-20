// Rotation Manager Admin API — schedule which packs appear in the Special Rotation shop section
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
        case 'set-date':    return await handleSetDate(sql, body)
        case 'remove-date': return await handleRemoveDate(sql, body)
        default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
      }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    console.error('rotation-manage error:', error)
    return { statusCode: 500, headers: adminHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

// ═══ GET: Load all scheduled dates + available pack types ═══
async function handleLoad(sql) {
  const [schedule, packTypes] = await Promise.all([
    sql`
      SELECT s.date, s.pack_type_id, pt.name AS pack_name, pt.cost,
             pt.cards_per_pack, COALESCE(pt.color, l.color) AS color,
             l.name AS league_name
      FROM cc_pack_rotation_schedule s
      JOIN cc_pack_types pt ON s.pack_type_id = pt.id
      LEFT JOIN leagues l ON pt.league_id = l.id
      ORDER BY s.date DESC, pt.sort_order
    `,
    sql`
      SELECT pt.id, pt.name, pt.cost, pt.cards_per_pack, pt.rotation_only,
             COALESCE(pt.color, l.color) AS color, l.name AS league_name,
             pt.division_ids, pt.sort_order
      FROM cc_pack_types pt
      LEFT JOIN leagues l ON pt.league_id = l.id
      WHERE pt.enabled = true
      ORDER BY pt.sort_order
    `,
  ])

  // Group schedule by date
  const grouped = {}
  for (const row of schedule) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10)
    if (!grouped[dateStr]) grouped[dateStr] = []
    grouped[dateStr].push({
      packTypeId: row.pack_type_id,
      packName: row.pack_name,
      cost: row.cost,
      cards: row.cards_per_pack,
      color: row.color,
      leagueName: row.league_name,
    })
  }

  return {
    statusCode: 200, headers: adminHeaders,
    body: JSON.stringify({
      schedule: grouped,
      packTypes: packTypes.map(p => ({
        id: p.id,
        name: p.name,
        cost: p.cost,
        cards: p.cards_per_pack,
        rotationOnly: p.rotation_only,
        color: p.color,
        leagueName: p.league_name,
        divisionIds: p.division_ids || [],
        sortOrder: p.sort_order,
      })),
    }),
  }
}

// ═══ POST: Set packs for a specific date ═══
async function handleSetDate(sql, body) {
  const { date, packTypeIds } = body
  if (!date) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'date required' }) }
  if (!Array.isArray(packTypeIds)) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'packTypeIds array required' }) }

  // Clear existing entries for this date, then insert new ones
  await sql`DELETE FROM cc_pack_rotation_schedule WHERE date = ${date}`

  for (const packTypeId of packTypeIds) {
    await sql`
      INSERT INTO cc_pack_rotation_schedule (date, pack_type_id)
      VALUES (${date}, ${packTypeId})
    `
  }

  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ ok: true }) }
}

// ═══ POST: Remove all packs for a date ═══
async function handleRemoveDate(sql, body) {
  const { date } = body
  if (!date) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'date required' }) }

  await sql`DELETE FROM cc_pack_rotation_schedule WHERE date = ${date}`
  return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ ok: true }) }
}

export const onRequest = adapt(handler)

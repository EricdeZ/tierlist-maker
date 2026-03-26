// Vault Device Log API — device fingerprint tracking + shared-device flagging
// POST action=log-login (any auth): record device_id/IP, flag shared devices
// GET  action=flags      (cardclash_manage): list unresolved flags
// GET  action=investigate (cardclash_manage): find users sharing IPs/devices
// POST action=resolve-flag (cardclash_manage): mark a flag resolved

import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requireAuth, requirePermission } from '../lib/auth.js'

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const { action } = event.queryStringParameters || {}
  const sql = getDB()

  // ── Auth-only actions ──────────────────────────────────────────────────────
  if (action === 'log-login') {
    const user = await requireAuth(event)
    if (!user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
    }

    const body = JSON.parse(event.body || '{}')
    const { deviceId, previousIds } = body

    if (!deviceId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'deviceId required' }) }
    }

    const ip =
      event.headers?.['cf-connecting-ip'] ||
      event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      null

    await sql`
      INSERT INTO cc_vault_device_log (user_id, device_id, ip_address)
      VALUES (${user.id}, ${deviceId}, ${ip})
    `

    if (Array.isArray(previousIds) && previousIds.length > 0) {
      for (const prevIdStr of previousIds) {
        const prevId = parseInt(prevIdStr, 10)
        if (!prevId || prevId === user.id) continue

        const [prevUser] = await sql`
          SELECT id FROM users WHERE id = ${prevId}
        `
        if (!prevUser) continue

        const [existing] = await sql`
          SELECT id FROM cc_vault_device_flags
          WHERE (user_a_id = ${user.id} AND user_b_id = ${prevId})
             OR (user_a_id = ${prevId} AND user_b_id = ${user.id})
        `
        if (existing) continue

        await sql`
          INSERT INTO cc_vault_device_flags (user_a_id, user_b_id)
          VALUES (${user.id}, ${prevId})
        `
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  }

  // ── Admin actions ──────────────────────────────────────────────────────────
  if (action === 'flags') {
    const admin = await requirePermission(event, 'cardclash_manage')
    if (!admin) {
      return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
    }

    const flags = await sql`
      SELECT
        f.id,
        f.user_a_id,
        f.user_b_id,
        f.resolved,
        f.resolved_by,
        f.resolved_at,
        f.flagged_at,
        ua.discord_username AS user_a_name,
        ua.discord_id       AS user_a_discord_id,
        ub.discord_username AS user_b_name,
        ub.discord_id       AS user_b_discord_id
      FROM cc_vault_device_flags f
      JOIN users ua ON ua.id = f.user_a_id
      JOIN users ub ON ub.id = f.user_b_id
      ORDER BY f.resolved ASC, f.flagged_at DESC
      LIMIT 100
    `

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ flags }) }
  }

  if (action === 'investigate') {
    const admin = await requirePermission(event, 'cardclash_manage')
    if (!admin) {
      return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
    }

    const { userId } = event.queryStringParameters || {}
    if (!userId) {
      return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'userId required' }) }
    }

    const uid = parseInt(userId, 10)

    const targetIps = await sql`
      SELECT DISTINCT ip_address FROM cc_vault_device_log
      WHERE user_id = ${uid} AND ip_address IS NOT NULL
    `
    const targetDevices = await sql`
      SELECT DISTINCT device_id FROM cc_vault_device_log
      WHERE user_id = ${uid}
    `

    const ipList = targetIps.map(r => r.ip_address)
    const deviceList = targetDevices.map(r => r.device_id)

    let matches = []
    if (ipList.length > 0 || deviceList.length > 0) {
      matches = await sql`
        SELECT DISTINCT
          l.user_id,
          u.discord_username,
          u.discord_id,
          l.ip_address,
          l.device_id
        FROM cc_vault_device_log l
        JOIN users u ON u.id = l.user_id
        WHERE l.user_id != ${uid}
          AND (
            ${ipList.length > 0 ? sql`l.ip_address = ANY(${ipList})` : sql`FALSE`}
            OR
            ${deviceList.length > 0 ? sql`l.device_id = ANY(${deviceList})` : sql`FALSE`}
          )
        ORDER BY l.user_id
      `
    }

    return {
      statusCode: 200,
      headers: adminHeaders,
      body: JSON.stringify({
        matches,
        targetIps: ipList,
        targetDevices: deviceList,
      }),
    }
  }

  if (action === 'resolve-flag') {
    const admin = await requirePermission(event, 'cardclash_manage')
    if (!admin) {
      return { statusCode: 403, headers: adminHeaders, body: JSON.stringify({ error: 'Permission denied' }) }
    }

    const body = JSON.parse(event.body || '{}')
    const { flagId } = body
    if (!flagId) {
      return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'flagId required' }) }
    }

    const [updated] = await sql`
      UPDATE cc_vault_device_flags
      SET resolved = TRUE, resolved_by = ${admin.id}, resolved_at = NOW()
      WHERE id = ${flagId} AND resolved = FALSE
      RETURNING id
    `

    if (!updated) {
      return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'Flag not found or already resolved' }) }
    }

    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
}

export const onRequest = adapt(handler)

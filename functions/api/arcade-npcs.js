import { adapt } from '../lib/adapter.js'
import { getDB, headers, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const { action } = event.queryStringParameters || {}

    try {
        if (event.httpMethod === 'GET') {
            if (action === 'admin-list') {
                const admin = await requirePermission(event, 'league_manage')
                if (!admin) return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
                const npcs = await sql`SELECT * FROM arcade_npcs ORDER BY id`
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ npcs }) }
            }
            // Public list — active only
            const npcs = await sql`
                SELECT id, name, quote, image_url, spawn_qx, spawn_qy
                FROM arcade_npcs WHERE active = true ORDER BY id
            `
            return { statusCode: 200, headers, body: JSON.stringify({ npcs }) }
        }

        if (event.httpMethod === 'POST') {
            const admin = await requirePermission(event, 'league_manage')
            if (!admin) return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }

            const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body

            switch (action) {
                case 'create': {
                    const { name, quote, image_url, spawn_qx, spawn_qy } = body
                    if (!name || !quote) {
                        return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Name and quote are required' }) }
                    }
                    const [npc] = await sql`
                        INSERT INTO arcade_npcs (name, quote, image_url, spawn_qx, spawn_qy, created_by)
                        VALUES (${name}, ${quote}, ${image_url || null}, ${spawn_qx || null}, ${spawn_qy || null}, ${admin.id})
                        RETURNING *
                    `
                    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ npc }) }
                }

                case 'update': {
                    const { id, name, quote, image_url, spawn_qx, spawn_qy, active } = body
                    if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }
                    const [npc] = await sql`
                        UPDATE arcade_npcs SET
                            name = COALESCE(${name || null}, name),
                            quote = COALESCE(${quote || null}, quote),
                            image_url = ${image_url !== undefined ? (image_url || null) : null},
                            spawn_qx = ${spawn_qx !== undefined ? (spawn_qx || null) : null},
                            spawn_qy = ${spawn_qy !== undefined ? (spawn_qy || null) : null},
                            active = COALESCE(${active !== undefined ? active : null}, active),
                            updated_at = NOW()
                        WHERE id = ${id}
                        RETURNING *
                    `
                    if (!npc) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'NPC not found' }) }
                    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ npc }) }
                }

                case 'toggle': {
                    const { id } = body
                    if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }
                    const [npc] = await sql`
                        UPDATE arcade_npcs SET active = NOT active, updated_at = NOW()
                        WHERE id = ${id} RETURNING *
                    `
                    if (!npc) return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'NPC not found' }) }
                    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ npc }) }
                }

                case 'delete': {
                    const { id } = body
                    if (!id) return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'id required' }) }
                    await sql`DELETE FROM arcade_npcs WHERE id = ${id}`
                    return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
                }

                default:
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('arcade-npcs error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}

export const onRequest = adapt(handler)

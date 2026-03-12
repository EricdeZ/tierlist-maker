import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'god'
}

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { action } = event.queryStringParameters || {}

            // Top player per god (most games played on that god)
            if (action === 'top-players') {
                // Get the top player for each god that has been played
                const rows = await sql`
                    SELECT DISTINCT ON (ranked.god_id)
                        ranked.god_id,
                        ranked.player_name,
                        ranked.player_slug,
                        ranked.games
                    FROM (
                        SELECT
                            g.id as god_id,
                            p.name as player_name,
                            p.slug as player_slug,
                            COUNT(*) as games
                        FROM player_game_stats pgs
                        JOIN league_players lp ON pgs.league_player_id = lp.id
                        JOIN players p ON lp.player_id = p.id
                        JOIN gods g ON LOWER(g.name) = LOWER(pgs.god_played)
                        GROUP BY g.id, p.id, p.name, p.slug
                    ) ranked
                    ORDER BY ranked.god_id, ranked.games DESC
                `
                // Get a random player as fallback for gods never played
                const fallbackRows = await sql`
                    SELECT name, slug FROM players ORDER BY RANDOM() LIMIT 1
                `
                const fallback = fallbackRows.length > 0
                    ? { playerName: fallbackRows[0].name, playerSlug: fallbackRows[0].slug, games: 0 }
                    : null

                const topPlayers = {}
                for (const r of rows) {
                    topPlayers[r.god_id] = { playerName: r.player_name, playerSlug: r.player_slug, games: Number(r.games) }
                }

                // Fill in fallback for all gods
                if (fallback) {
                    const allGods = await sql`SELECT id FROM gods`
                    for (const g of allGods) {
                        if (!topPlayers[g.id]) {
                            topPlayers[g.id] = fallback
                        }
                    }
                }

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ topPlayers }),
                }
            }

            const gods = await sql`
                SELECT id, name, slug, image_url
                FROM gods
                ORDER BY name
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(gods),
            }
        }

        if (event.httpMethod === 'POST') {
            const admin = await requirePermission(event, 'league_manage')
            if (!admin) {
                return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }
            }

            const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
            const { action, id, name, image_url } = body

            if (action === 'create') {
                if (!name?.trim()) {
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Name is required' }) }
                }
                const slug = slugify(name.trim())
                const [god] = await sql`
                    INSERT INTO gods (name, slug, image_url)
                    VALUES (${name.trim()}, ${slug}, ${image_url || null})
                    RETURNING *
                `
                await logAudit(sql, admin, { action: 'create-god', endpoint: 'gods', targetType: 'god', targetId: god.id, details: { name: god.name } })
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true, god }) }
            }

            if (action === 'update') {
                if (!id) {
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'ID is required' }) }
                }
                if (!name?.trim()) {
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Name is required' }) }
                }
                const slug = slugify(name.trim())
                const [god] = await sql`
                    UPDATE gods
                    SET name = ${name.trim()}, slug = ${slug}, image_url = ${image_url || null}
                    WHERE id = ${id}
                    RETURNING *
                `
                if (!god) {
                    return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'God not found' }) }
                }
                await logAudit(sql, admin, { action: 'update-god', endpoint: 'gods', targetType: 'god', targetId: god.id, details: { name: god.name } })
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true, god }) }
            }

            if (action === 'delete') {
                if (!id) {
                    return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'ID is required' }) }
                }
                const [god] = await sql`DELETE FROM gods WHERE id = ${id} RETURNING *`
                if (!god) {
                    return { statusCode: 404, headers: adminHeaders, body: JSON.stringify({ error: 'God not found' }) }
                }
                await logAudit(sql, admin, { action: 'delete-god', endpoint: 'gods', targetType: 'god', targetId: god.id, details: { name: god.name } })
                return { statusCode: 200, headers: adminHeaders, body: JSON.stringify({ success: true }) }
            }

            return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Unknown action' }) }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        }
    } catch (error) {
        console.error('Database error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}

export const onRequest = adapt(handler)

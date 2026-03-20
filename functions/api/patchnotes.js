import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { action, slug } = event.queryStringParameters || {}

            if (action === 'detail') {
                if (!slug) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'slug is required' }),
                    }
                }

                const [patchNote] = await sql`
                    SELECT * FROM patch_notes WHERE slug = ${slug}
                `

                if (!patchNote) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Patch note not found' }),
                    }
                }

                const godChanges = await sql`
                    SELECT pngc.*, g.image_url as god_image_url
                    FROM patch_note_god_changes pngc
                    LEFT JOIN gods g ON g.id = pngc.god_id
                    WHERE pngc.patch_note_id = ${patchNote.id}
                    ORDER BY pngc.sort_order
                `

                const itemChanges = await sql`
                    SELECT * FROM patch_note_item_changes
                    WHERE patch_note_id = ${patchNote.id}
                    ORDER BY sort_order
                `

                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify({ patchNote, godChanges, itemChanges }),
                }
            }

            const patchNotes = await sql`
                SELECT id, slug, title, version, patch_date, subtitle, buff_count, nerf_count, new_item_count, rework_count, created_at
                FROM patch_notes ORDER BY patch_date DESC
            `

            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(patchNotes),
            }
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

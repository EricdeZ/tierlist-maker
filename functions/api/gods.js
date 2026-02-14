import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
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

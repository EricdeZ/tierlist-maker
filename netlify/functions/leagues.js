import { getDB, headers } from './lib/db.js'

export const handler = async (event, context) => {
    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const leagues = await sql`
        SELECT id, name, slug FROM leagues 
        ORDER BY name
      `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(leagues),
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
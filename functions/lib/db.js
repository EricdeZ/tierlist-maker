// functions/lib/db.js — Cloudflare Workers compatible
import { neon, Client, neonConfig } from '@neondatabase/serverless'

let _sql

export const handleCors = (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: getHeaders(),
            body: '',
        }
    }
    return null
}

export const getDB = () => {
    if (!_sql) {
        _sql = neon(process.env.DATABASE_URL)
    }
    return _sql
}

/**
 * Run a function inside a database transaction with tagged template syntax.
 * Uses WebSocket Client for persistent connection (required for transactions).
 *
 * Usage:
 *   const result = await transaction(async (tx) => {
 *       const [row] = await tx`INSERT INTO ... RETURNING *`
 *       await tx`UPDATE ... WHERE id = ${row.id}`
 *       return row
 *   })
 */
export async function transaction(fn) {
    neonConfig.webSocketConstructor = globalThis.WebSocket

    const client = new Client(process.env.DATABASE_URL)
    await client.connect()

    // Tagged template function that uses the client
    const tx = (strings, ...values) => {
        const text = strings.reduce((prev, curr, i) =>
            i === 0 ? curr : prev + '$' + i + curr
        , '')
        return client.query(text, values).then(r => r.rows)
    }

    try {
        await client.query('BEGIN')
        const result = await fn(tx)
        await client.query('COMMIT')
        return result
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        await client.end()
    }
}

const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Content-Type': 'application/json',
}

// Read endpoints: cache in production for anonymous users
export const getHeaders = (event) => {
    const isProd = process.env.CONTEXT === 'production'
    const hasAuth = event?.headers?.authorization
    if (isProd && !hasAuth) {
        return { ...baseHeaders, 'Cache-Control': 'public, max-age=300' }
    }
    return baseHeaders
}

// Static export for CORS preflight, auth endpoints, and other non-cached uses
export const headers = baseHeaders

// Admin endpoints: restrict origin if ALLOWED_ORIGIN is set
// Uses getter so process.env is read at response time, not module load time
export const adminHeaders = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Content-Type': 'application/json',
}
Object.defineProperty(adminHeaders, 'Access-Control-Allow-Origin', {
    get() { return process.env.ALLOWED_ORIGIN || '*' },
    enumerable: true,
    configurable: true,
})

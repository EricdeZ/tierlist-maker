// netlify/functions/lib/db.js
import postgres from 'postgres'

let sql

export const handleCors = (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: '',
        }
    }
    return null
}

export const getDB = () => {
    if (!sql) {
        sql = postgres(process.env.DATABASE_URL, {
            ssl: 'require',
            max: 1, // Netlify functions are stateless
        })
    }
    return sql
}

const isProd = process.env.CONTEXT === 'production'

const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Content-Type': 'application/json',
}

// Read endpoints: cache in production for anonymous users, skip for authenticated admins
export const getHeaders = (event) => {
    const hasAuth = event?.headers?.authorization
    if (isProd && !hasAuth) {
        return { ...baseHeaders, 'Cache-Control': 'public, max-age=300' }
    }
    return baseHeaders
}

// Static export for CORS preflight, auth endpoints, and other non-cached uses
export const headers = baseHeaders

// Admin endpoints: restrict origin if ALLOWED_ORIGIN is set
export const adminHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Content-Type': 'application/json',
}
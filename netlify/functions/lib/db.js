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

export const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json',
}
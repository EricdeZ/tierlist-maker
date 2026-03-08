/**
 * Adapter for Cloudflare Pages Functions.
 * Converts CF Request → simplified event shape, calls handler, converts response back.
 */
export function adapt(handler) {
    return async function onRequest(context) {
        const { request, env } = context

        // Populate process.env from Cloudflare env bindings
        for (const [key, value] of Object.entries(env)) {
            if (typeof value === 'string') {
                process.env[key] = value
            }
        }

        const url = new URL(request.url)

        // Build query string parameters
        const queryStringParameters = {}
        for (const [key, value] of url.searchParams) {
            queryStringParameters[key] = value
        }

        // Read body for POST/PUT/PATCH
        let body = null
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
            body = await request.text()
        }

        // Build lowercase headers map
        const headers = {}
        for (const [key, value] of request.headers) {
            headers[key.toLowerCase()] = value
        }

        // Construct event object for handler
        const event = {
            httpMethod: request.method,
            headers,
            queryStringParameters,
            body,
            path: url.pathname,
            rawUrl: request.url,
            waitUntil: context.waitUntil.bind(context),
            env,
        }

        let result
        try {
            result = await handler(event)
        } catch (err) {
            console.error('Unhandled function error:', err)
            return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            })
        }

        return new Response(result.body || '', {
            status: result.statusCode || 200,
            headers: result.headers || {},
        })
    }
}

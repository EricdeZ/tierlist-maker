// Serves images from R2 by key — works locally (wrangler binding) and production
import { ALLOWED_PREFIXES } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    const url = new URL(request.url)
    const key = url.searchParams.get('key')

    if (!key || !ALLOWED_PREFIXES.some(p => key.startsWith(p))) {
        return new Response('Not found', { status: 404 })
    }

    const obj = await env.TEAM_ICONS.get(key)
    if (!obj) return new Response('Not found', { status: 404 })

    return new Response(obj.body, {
        headers: {
            'content-type': obj.httpMetadata?.contentType || 'image/png',
            'cache-control': 'public, max-age=31536000, immutable',
        },
    })
}

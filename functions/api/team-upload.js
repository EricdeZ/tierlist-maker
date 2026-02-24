// Team icon upload endpoint — uses custom onRequest (not adapt) for multipart form handling
import { getDB, adminHeaders } from '../lib/db.js'
import { requireAnyPermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 512 * 1024 // 512KB
const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const ALL_EXTS = Object.values(EXT_MAP)

function validateMagicBytes(bytes, mimeType) {
    if (bytes.length < 4) return false
    if (mimeType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    if (mimeType === 'image/jpeg') return bytes[0] === 0xFF && bytes[1] === 0xD8
    if (mimeType === 'image/gif') return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    if (mimeType === 'image/webp') return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    return false
}

function buildEvent(request, url) {
    const headers = {}
    for (const [key, value] of request.headers) {
        headers[key.toLowerCase()] = value
    }
    const queryStringParameters = {}
    for (const [key, value] of url.searchParams) {
        queryStringParameters[key] = value
    }
    return { httpMethod: request.method, headers, queryStringParameters, body: null, path: url.pathname, rawUrl: request.url }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: adminHeaders })
}

export async function onRequest(context) {
    const { request, env } = context

    // Populate process.env from string bindings
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') process.env[key] = value
    }

    const url = new URL(request.url)
    const event = buildEvent(request, url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: adminHeaders })
    }

    // Auth — require team_manage or league_manage permission
    const result = await requireAnyPermission(event, ['team_manage', 'league_manage'])
    if (!result) return json({ error: 'Unauthorized' }, 401)
    const admin = result.user

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, admin, env)
    }
    if (request.method === 'DELETE') {
        const teamId = url.searchParams.get('teamId')
        return handleDelete(sql, bucket, admin, teamId)
    }

    return json({ error: 'Method not allowed' }, 405)
}

async function handleUpload(request, sql, bucket, admin, env) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const teamId = formData.get('teamId')
    const file = formData.get('file')

    if (!teamId) return json({ error: 'teamId required' }, 400)
    if (!file || typeof file === 'string') return json({ error: 'file required' }, 400)

    // Validate team exists
    const [team] = await sql`SELECT id FROM teams WHERE id = ${parseInt(teamId)}`
    if (!team) return json({ error: 'Team not found' }, 404)

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, 415)
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
        return json({ error: 'Image must be under 512KB' }, 413)
    }

    // Read bytes and validate magic bytes
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!validateMagicBytes(bytes, file.type)) {
        return json({ error: 'File content does not match declared type' }, 415)
    }

    const ext = EXT_MAP[file.type]
    const key = `team-icons/${team.id}.${ext}`

    // Remove old icons with different extensions
    for (const e of ALL_EXTS) {
        if (e !== ext) {
            await bucket.delete(`team-icons/${team.id}.${e}`)
        }
    }

    // Upload to R2
    await bucket.put(key, bytes, {
        httpMetadata: { contentType: file.type },
    })

    // Build URL with cache buster
    const r2Base = env.R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || ''
    const publicUrl = `${r2Base}/${key}?v=${Date.now()}`

    // Update DB
    await sql`UPDATE teams SET logo_url = ${publicUrl}, updated_at = NOW() WHERE id = ${team.id}`

    logAudit(sql, admin, {
        action: 'upload-team-icon', endpoint: 'team-upload',
        targetType: 'team', targetId: team.id, details: { url: publicUrl },
    })

    return json({ success: true, logoUrl: publicUrl })
}

async function handleDelete(sql, bucket, admin, teamId) {
    if (!teamId) return json({ error: 'teamId required' }, 400)

    const [team] = await sql`SELECT id, logo_url FROM teams WHERE id = ${parseInt(teamId)}`
    if (!team) return json({ error: 'Team not found' }, 404)
    if (!team.logo_url) return json({ error: 'Team has no icon' }, 400)

    // Extract R2 key from URL (team-icons/42.webp?v=...)
    try {
        const urlPath = new URL(team.logo_url).pathname
        const key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
        await bucket.delete(key)
    } catch {
        // Best-effort cleanup — delete all possible extensions
        for (const e of ALL_EXTS) {
            await bucket.delete(`team-icons/${team.id}.${e}`)
        }
    }

    await sql`UPDATE teams SET logo_url = NULL, updated_at = NOW() WHERE id = ${team.id}`

    logAudit(sql, admin, {
        action: 'delete-team-icon', endpoint: 'team-upload',
        targetType: 'team', targetId: team.id,
    })

    return json({ success: true })
}

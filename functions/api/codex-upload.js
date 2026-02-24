// Codex image upload endpoint — uses custom onRequest (not adapt) for multipart form handling
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 512 * 1024 // 512KB
const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

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

    // Auth — require codex_edit permission
    const admin = await requirePermission(event, 'codex_edit')
    if (!admin) return json({ error: 'Unauthorized' }, 401)

    const sql = getDB()
    const bucket = env.TEAM_ICONS // Reuse same R2 bucket with codex/ prefix

    if (request.method === 'GET') {
        return handleList(sql, url)
    }
    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, admin, env)
    }
    if (request.method === 'DELETE') {
        const id = url.searchParams.get('id')
        return handleDelete(sql, bucket, admin, id)
    }

    return json({ error: 'Method not allowed' }, 405)
}

async function handleList(sql, url) {
    const category = url.searchParams.get('category')

    let images
    if (category) {
        images = await sql`SELECT * FROM codex_images WHERE category = ${category} ORDER BY created_at DESC`
    } else {
        images = await sql`SELECT * FROM codex_images ORDER BY created_at DESC`
    }

    const categories = await sql`SELECT DISTINCT category FROM codex_images WHERE category IS NOT NULL ORDER BY category`

    return json({ images, categories: categories.map(c => c.category) })
}

async function handleUpload(request, sql, bucket, admin, env) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const file = formData.get('file')
    const category = formData.get('category') || null

    if (!file || typeof file === 'string') return json({ error: 'file required' }, 400)

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
    const filename = file.name || `image.${ext}`

    // Insert DB row first to get the ID for the R2 key
    const [row] = await sql`
        INSERT INTO codex_images (filename, url, category, uploaded_by)
        VALUES (${filename}, '', ${category}, ${admin.id})
        RETURNING id
    `

    const key = `codex/${row.id}.${ext}`

    // Upload to R2
    await bucket.put(key, bytes, {
        httpMetadata: { contentType: file.type },
    })

    // Build URL with cache buster and update the row
    const r2Base = env.R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || ''
    const publicUrl = `${r2Base}/${key}?v=${Date.now()}`
    await sql`UPDATE codex_images SET url = ${publicUrl} WHERE id = ${row.id}`

    logAudit(sql, admin, {
        action: 'upload-codex-image', endpoint: 'codex-upload',
        targetType: 'codex_image', targetId: row.id, details: { filename, category },
    })

    return json({ success: true, image: { id: row.id, filename, url: publicUrl, category } })
}

async function handleDelete(sql, bucket, admin, id) {
    if (!id) return json({ error: 'id required' }, 400)

    const [image] = await sql`SELECT id, url, filename FROM codex_images WHERE id = ${parseInt(id)}`
    if (!image) return json({ error: 'Image not found' }, 404)

    // Delete from R2
    try {
        const urlPath = new URL(image.url).pathname
        const key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
        await bucket.delete(key)
    } catch {
        // Best-effort — URL might be malformed
    }

    await sql`DELETE FROM codex_images WHERE id = ${image.id}`

    logAudit(sql, admin, {
        action: 'delete-codex-image', endpoint: 'codex-upload',
        targetType: 'codex_image', targetId: image.id, details: { filename: image.filename },
    })

    return json({ success: true })
}

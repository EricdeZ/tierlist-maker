// Codex image upload endpoint — uses custom onRequest (not adapt) for multipart form handling
import { getDB } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { validateImageFile, uploadToR2, deleteR2Object, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    const { event, url } = buildUploadEvent(request)

    if (request.method === 'OPTIONS') {
        return json({}, 204)
    }

    const admin = await requirePermission(event, 'codex_edit')
    if (!admin) return json({ error: 'Unauthorized' }, 401)

    const sql = getDB()
    const bucket = env.TEAM_ICONS // Reuse same R2 bucket with codex/ prefix

    if (request.method === 'GET') {
        return handleList(sql, url)
    }
    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, admin)
    }
    if (request.method === 'DELETE') {
        return handleDelete(sql, bucket, admin, url.searchParams.get('id'))
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

async function handleUpload(request, sql, bucket, admin) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const file = formData.get('file')
    const category = formData.get('category') || null

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(file))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const filename = file.name || `image.${ext}`

    // Insert DB row first to get the ID for the R2 key
    const [row] = await sql`
        INSERT INTO codex_images (filename, url, category, uploaded_by)
        VALUES (${filename}, '', ${category}, ${admin.id})
        RETURNING id
    `

    const key = `codex/${row.id}.${ext}`
    const publicUrl = await uploadToR2(bucket, key, bytes, file.type)

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

    try {
        await deleteR2Object(bucket, image.url)
    } catch { /* best-effort */ }

    await sql`DELETE FROM codex_images WHERE id = ${image.id}`

    logAudit(sql, admin, {
        action: 'delete-codex-image', endpoint: 'codex-upload',
        targetType: 'codex_image', targetId: image.id, details: { filename: image.filename },
    })

    return json({ success: true })
}

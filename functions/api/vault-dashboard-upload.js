// Vault Dashboard upload — uses raw onRequest (not adapt) for multipart form handling
// Same pattern as codex-upload.js
import { getDB } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { validateImageFile, uploadToR2, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    const { event, url } = buildUploadEvent(request)

    if (request.method === 'OPTIONS') {
        return json({}, 204)
    }

    const user = await requirePermission(event, 'vault_member')
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    const action = url.searchParams.get('action')

    if (request.method === 'POST' && action === 'upload-asset') {
        return handleAssetUpload(request, sql, bucket, user)
    }
    if (request.method === 'POST' && action === 'export-thumbnail') {
        return handleThumbnailExport(request, sql, bucket, user, url)
    }

    return json({ error: 'Unknown action' }, 400)
}

async function handleAssetUpload(request, sql, bucket, user) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const file = formData.get('file')
    const name = formData.get('name') || file?.name || 'Untitled'
    const category = formData.get('category') || 'background'
    const tagsRaw = formData.get('tags')
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(file))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    // Insert DB row first to get ID
    const [row] = await sql`
        INSERT INTO cc_asset_library (name, category, url, tags, metadata, uploaded_by)
        VALUES (${name}, ${category}, '', ${tags}, ${JSON.stringify({ size: bytes.length, format: ext })}, ${user.id})
        RETURNING id
    `

    const key = `vault-assets/${category}/${row.id}.${ext}`
    const publicUrl = await uploadToR2(bucket, key, bytes, file.type)

    const thumbKey = `vault-assets/thumbnails/${row.id}.${ext}`
    const thumbUrl = await uploadToR2(bucket, thumbKey, bytes, file.type)

    await sql`UPDATE cc_asset_library SET url = ${publicUrl}, thumbnail_url = ${thumbUrl} WHERE id = ${row.id}`

    return json({
        success: true,
        asset: { id: row.id, name, category, url: publicUrl, thumbnail_url: thumbUrl, tags }
    })
}

async function handleThumbnailExport(request, sql, bucket, user, url) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const file = formData.get('file')
    const type = url.searchParams.get('type')
    const id = parseInt(url.searchParams.get('id'))

    if (!id) return json({ error: 'id required' }, 400)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(file))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const key = `vault-assets/thumbnails/${type}-${id}.${ext}`
    const publicUrl = await uploadToR2(bucket, key, bytes, file.type)

    await sql`UPDATE cc_card_blueprints SET thumbnail_url = ${publicUrl}, updated_at = NOW() WHERE id = ${id}`

    return json({ success: true, thumbnail_url: publicUrl })
}

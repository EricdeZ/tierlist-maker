import { getDB } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { validateImageFile, uploadToR2, cleanOldExtensions, deleteR2Object, ALL_EXTS, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    const { event, url } = buildUploadEvent(request)

    if (request.method === 'OPTIONS') {
        return json({}, 204)
    }

    const result = await requirePermission(event, 'league_manage')
    if (!result) return json({ error: 'Unauthorized' }, 401)
    const admin = result.user

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, admin)
    }
    if (request.method === 'DELETE') {
        return handleDelete(sql, bucket, admin, url.searchParams.get('leagueId'))
    }

    return json({ error: 'Method not allowed' }, 405)
}

async function handleUpload(request, sql, bucket, admin) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const leagueId = formData.get('leagueId')
    if (!leagueId) return json({ error: 'leagueId required' }, 400)

    const [league] = await sql`SELECT id FROM leagues WHERE id = ${parseInt(leagueId)}`
    if (!league) return json({ error: 'League not found' }, 404)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(formData.get('file')))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const key = `league-icons/${league.id}.${ext}`
    await cleanOldExtensions(bucket, 'league-icons/', league.id, ext)
    const publicUrl = await uploadToR2(bucket, key, bytes, formData.get('file').type)

    await sql`UPDATE leagues SET image_url = ${publicUrl}, updated_at = NOW() WHERE id = ${league.id}`

    logAudit(sql, admin, {
        action: 'upload-league-icon', endpoint: 'league-upload',
        targetType: 'league', targetId: league.id, details: { url: publicUrl },
    })

    return json({ success: true, imageUrl: publicUrl })
}

async function handleDelete(sql, bucket, admin, leagueId) {
    if (!leagueId) return json({ error: 'leagueId required' }, 400)

    const [league] = await sql`SELECT id, image_url FROM leagues WHERE id = ${parseInt(leagueId)}`
    if (!league) return json({ error: 'League not found' }, 404)
    if (!league.image_url) return json({ error: 'League has no image' }, 400)

    try {
        await deleteR2Object(bucket, league.image_url)
    } catch {
        for (const e of ALL_EXTS) {
            await bucket.delete(`league-icons/${league.id}.${e}`)
        }
    }

    await sql`UPDATE leagues SET image_url = NULL, updated_at = NOW() WHERE id = ${league.id}`

    logAudit(sql, admin, {
        action: 'delete-league-icon', endpoint: 'league-upload',
        targetType: 'league', targetId: league.id,
    })

    return json({ success: true })
}

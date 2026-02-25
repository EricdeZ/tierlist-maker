// Team icon upload endpoint — uses custom onRequest (not adapt) for multipart form handling
import { getDB } from '../lib/db.js'
import { requireAnyPermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'
import { validateImageFile, uploadToR2, cleanOldExtensions, deleteR2Object, ALL_EXTS, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    const { event, url } = buildUploadEvent(request)

    if (request.method === 'OPTIONS') {
        return json({}, 204)
    }

    const result = await requireAnyPermission(event, ['team_manage', 'league_manage'])
    if (!result) return json({ error: 'Unauthorized' }, 401)
    const admin = result.user

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, admin)
    }
    if (request.method === 'DELETE') {
        return handleDelete(sql, bucket, admin, url.searchParams.get('teamId'))
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

    const teamId = formData.get('teamId')
    if (!teamId) return json({ error: 'teamId required' }, 400)

    const [team] = await sql`SELECT id FROM teams WHERE id = ${parseInt(teamId)}`
    if (!team) return json({ error: 'Team not found' }, 404)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(formData.get('file')))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const key = `team-icons/${team.id}.${ext}`
    await cleanOldExtensions(bucket, 'team-icons/', team.id, ext)
    const publicUrl = await uploadToR2(bucket, key, bytes, formData.get('file').type)

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

    try {
        await deleteR2Object(bucket, team.logo_url)
    } catch {
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

import { getDB } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { validateImageFile, uploadToR2, cleanOldExtensions, deleteR2Object, ALL_EXTS, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    const { event, url } = buildUploadEvent(request)

    if (request.method === 'OPTIONS') {
        return json({}, 204)
    }

    const user = await requireAuth(event)
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    if (request.method === 'POST') {
        return handleUpload(request, sql, bucket, user)
    }
    if (request.method === 'DELETE') {
        return handleDelete(sql, bucket, user, url.searchParams.get('teamId'))
    }

    return json({ error: 'Method not allowed' }, 405)
}

async function handleUpload(request, sql, bucket, user) {
    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const teamId = formData.get('teamId')
    if (!teamId) return json({ error: 'teamId required' }, 400)

    // Verify user is captain of this community team
    const [team] = await sql`SELECT id FROM community_teams WHERE id = ${parseInt(teamId)}`
    if (!team) return json({ error: 'Team not found' }, 404)

    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${team.id} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return json({ error: 'Only the team captain can upload a logo' }, 403)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(formData.get('file')))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const key = `community-teams/${team.id}.${ext}`
    await cleanOldExtensions(bucket, 'community-teams/', team.id, ext)
    const publicUrl = await uploadToR2(bucket, key, bytes, formData.get('file').type)

    await sql`UPDATE community_teams SET logo_url = ${publicUrl}, updated_at = NOW() WHERE id = ${team.id}`

    return json({ success: true, logoUrl: publicUrl })
}

async function handleDelete(sql, bucket, user, teamId) {
    if (!teamId) return json({ error: 'teamId required' }, 400)

    const [team] = await sql`SELECT id, logo_url FROM community_teams WHERE id = ${parseInt(teamId)}`
    if (!team) return json({ error: 'Team not found' }, 404)

    const [captain] = await sql`
        SELECT 1 FROM community_team_members
        WHERE team_id = ${team.id} AND user_id = ${user.id} AND role = 'captain' AND status = 'active'
    `
    if (!captain) return json({ error: 'Only the team captain can remove the logo' }, 403)

    if (!team.logo_url) return json({ error: 'Team has no logo' }, 400)

    try {
        await deleteR2Object(bucket, team.logo_url)
    } catch {
        for (const e of ALL_EXTS) {
            await bucket.delete(`community-teams/${team.id}.${e}`)
        }
    }

    await sql`UPDATE community_teams SET logo_url = NULL, updated_at = NOW() WHERE id = ${team.id}`

    return json({ success: true })
}

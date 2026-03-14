// Vault Dashboard API — card templates, drafts, assets management
import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'

async function handler(event) {
    const sql = getDB()
    const action = event.queryStringParameters?.action

    // All actions require vault_member
    const user = await requirePermission(event, 'vault_member')
    if (!user) return { statusCode: 401, headers: adminHeaders, body: JSON.stringify({ error: 'Unauthorized' }) }

    // Check if user has vault_approve permission (for owner-level actions)
    let canApprove = false
    try {
        const approver = await requirePermission(event, 'vault_approve')
        canApprove = !!approver
    } catch { canApprove = false }

    if (event.httpMethod === 'GET') {
        switch (action) {
            case 'templates': return getTemplates(sql, event, user, canApprove)
            case 'template': return getTemplate(sql, event, user, canApprove)
            case 'drafts': return getDrafts(sql, event, user, canApprove)
            case 'draft': return getDraft(sql, event, user, canApprove)
            case 'assets': return getAssets(sql, event)
            case 'asset': return getAsset(sql, event)
            default: return err('Unknown action')
        }
    }

    if (event.httpMethod === 'POST') {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
        switch (action) {
            case 'save-template': return saveTemplate(sql, body, user, canApprove)
            case 'save-draft': return saveDraft(sql, body, user, canApprove)
            case 'submit-for-review': return submitForReview(sql, body, user)
            case 'approve': return approveItem(sql, body, user, canApprove)
            case 'reject': return rejectItem(sql, body, user, canApprove)
            case 'archive-template': return archiveTemplate(sql, body, canApprove)
            case 'delete-asset': return deleteAsset(sql, body, canApprove, event)
            default: return err('Unknown action')
        }
    }

    return { statusCode: 405, headers: adminHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
}

const ok = (data) => ({ statusCode: 200, headers: adminHeaders, body: JSON.stringify(data) })
const err = (msg, status = 400) => ({ statusCode: status, headers: adminHeaders, body: JSON.stringify({ error: msg }) })

// ─── GET Handlers ───

async function getTemplates(sql, event, user, canApprove) {
    const { status, rarity, card_type, creator } = event.queryStringParameters || {}
    let rows
    if (canApprove) {
        rows = await sql`
            SELECT t.*, u.username AS creator_name
            FROM cc_card_templates t
            LEFT JOIN users u ON u.id = t.created_by
            WHERE (${status || null}::text IS NULL OR t.status = ${status})
              AND (${rarity || null}::text IS NULL OR t.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR t.card_type = ${card_type})
              AND (${creator ? parseInt(creator) : null}::int IS NULL OR t.created_by = ${creator ? parseInt(creator) : 0})
            ORDER BY t.updated_at DESC
        `
    } else {
        rows = await sql`
            SELECT t.*, u.username AS creator_name
            FROM cc_card_templates t
            LEFT JOIN users u ON u.id = t.created_by
            WHERE t.created_by = ${user.id}
              AND (${status || null}::text IS NULL OR t.status = ${status})
              AND (${rarity || null}::text IS NULL OR t.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR t.card_type = ${card_type})
            ORDER BY t.updated_at DESC
        `
    }
    return ok({ templates: rows })
}

async function getTemplate(sql, event, user, canApprove) {
    const id = parseInt(event.queryStringParameters?.id)
    if (!id) return err('id required')
    const [row] = await sql`SELECT * FROM cc_card_templates WHERE id = ${id}`
    if (!row) return err('Template not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)
    return ok({ template: row })
}

async function getDrafts(sql, event, user, canApprove) {
    const { status, rarity, creator } = event.queryStringParameters || {}
    let rows
    if (canApprove) {
        rows = await sql`
            SELECT d.*, u.username AS creator_name
            FROM cc_card_drafts d
            LEFT JOIN users u ON u.id = d.created_by
            WHERE (${status || null}::text IS NULL OR d.status = ${status})
              AND (${rarity || null}::text IS NULL OR d.rarity = ${rarity})
              AND (${creator ? parseInt(creator) : null}::int IS NULL OR d.created_by = ${creator ? parseInt(creator) : 0})
            ORDER BY d.updated_at DESC
        `
    } else {
        rows = await sql`
            SELECT d.*, u.username AS creator_name
            FROM cc_card_drafts d
            LEFT JOIN users u ON u.id = d.created_by
            WHERE d.created_by = ${user.id}
              AND (${status || null}::text IS NULL OR d.status = ${status})
              AND (${rarity || null}::text IS NULL OR d.rarity = ${rarity})
            ORDER BY d.updated_at DESC
        `
    }
    return ok({ drafts: rows })
}

async function getDraft(sql, event, user, canApprove) {
    const id = parseInt(event.queryStringParameters?.id)
    if (!id) return err('id required')
    const [row] = await sql`SELECT * FROM cc_card_drafts WHERE id = ${id}`
    if (!row) return err('Draft not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)
    return ok({ draft: row })
}

async function getAssets(sql, event) {
    const { category, search } = event.queryStringParameters || {}
    const rows = await sql`
        SELECT * FROM cc_asset_library
        WHERE (${category || null}::text IS NULL OR category = ${category})
          AND (${search || null}::text IS NULL OR name ILIKE ${'%' + (search || '') + '%'} OR ${search || ''} = ANY(tags))
        ORDER BY created_at DESC
    `
    return ok({ assets: rows })
}

async function getAsset(sql, event) {
    const id = parseInt(event.queryStringParameters?.id)
    if (!id) return err('id required')
    const [row] = await sql`SELECT * FROM cc_asset_library WHERE id = ${id}`
    if (!row) return err('Asset not found', 404)
    const [{ count: templateCount }] = await sql`
        SELECT COUNT(*)::int AS count FROM cc_card_templates
        WHERE template_data::text LIKE ${'%"assetId":' + id + '%'}
    `
    const [{ count: draftCount }] = await sql`
        SELECT COUNT(*)::int AS count FROM cc_card_drafts
        WHERE template_data::text LIKE ${'%"assetId":' + id + '%'}
    `
    return ok({ asset: row, usageCount: templateCount + draftCount })
}

// ─── POST Handlers ───

async function saveTemplate(sql, body, user, canApprove) {
    const { id, name, description, card_type, rarity, template_data } = body
    if (!name || !card_type || !rarity || !template_data) return err('name, card_type, rarity, template_data required')

    if (id) {
        const [existing] = await sql`SELECT * FROM cc_card_templates WHERE id = ${id}`
        if (!existing) return err('Template not found', 404)
        if (!canApprove && existing.created_by !== user.id) return err('Not authorized', 403)
        if (!canApprove && existing.status !== 'draft' && existing.status !== 'rejected') return err('Can only edit drafts or rejected templates')

        const [row] = await sql`
            UPDATE cc_card_templates
            SET name = ${name}, description = ${description || null}, card_type = ${card_type},
                rarity = ${rarity}, template_data = ${JSON.stringify(template_data)},
                status = ${existing.status === 'rejected' ? 'draft' : existing.status},
                rejection_reason = ${existing.status === 'rejected' ? null : existing.rejection_reason},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `
        return ok({ template: row })
    } else {
        const [row] = await sql`
            INSERT INTO cc_card_templates (name, description, card_type, rarity, template_data, created_by)
            VALUES (${name}, ${description || null}, ${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${user.id})
            RETURNING *
        `
        return ok({ template: row })
    }
}

async function saveDraft(sql, body, user, canApprove) {
    const { id, card_type, rarity, template_data, target_player_id, notes } = body
    if (!card_type || !rarity || !template_data) return err('card_type, rarity, template_data required')

    if (id) {
        const [existing] = await sql`SELECT * FROM cc_card_drafts WHERE id = ${id}`
        if (!existing) return err('Draft not found', 404)
        if (!canApprove && existing.created_by !== user.id) return err('Not authorized', 403)
        if (!canApprove && existing.status !== 'draft' && existing.status !== 'rejected') return err('Can only edit drafts or rejected items')

        const [row] = await sql`
            UPDATE cc_card_drafts
            SET card_type = ${card_type}, rarity = ${rarity},
                template_data = ${JSON.stringify(template_data)},
                target_player_id = ${target_player_id || null},
                notes = ${notes || null},
                status = ${existing.status === 'rejected' ? 'draft' : existing.status},
                rejection_reason = ${existing.status === 'rejected' ? null : existing.rejection_reason},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `
        return ok({ draft: row })
    } else {
        const [row] = await sql`
            INSERT INTO cc_card_drafts (card_type, rarity, template_data, target_player_id, notes, created_by)
            VALUES (${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${target_player_id || null}, ${notes || null}, ${user.id})
            RETURNING *
        `
        return ok({ draft: row })
    }
}

async function submitForReview(sql, body, user) {
    const { type, id } = body
    if (!type || !id) return err('type and id required')
    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'

    const rows = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
    const row = rows[0]
    if (!row) return err('Not found', 404)
    if (row.created_by !== user.id) return err('Not authorized', 403)
    if (row.status !== 'draft' && row.status !== 'rejected') return err('Only drafts or rejected items can be submitted')

    await sql`UPDATE ${sql(table)} SET status = 'pending_review', rejection_reason = NULL, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function approveItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { type, id } = body
    if (!type || !id) return err('type and id required')
    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'

    const rows = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
    if (!rows[0]) return err('Not found', 404)
    if (rows[0].status !== 'pending_review') return err('Only pending items can be approved')

    await sql`UPDATE ${sql(table)} SET status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function rejectItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { type, id, reason } = body
    if (!type || !id) return err('type and id required')
    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'

    const rows = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
    if (!rows[0]) return err('Not found', 404)
    if (rows[0].status !== 'pending_review') return err('Only pending items can be rejected')

    await sql`UPDATE ${sql(table)} SET status = 'rejected', rejection_reason = ${reason || null}, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function archiveTemplate(sql, body, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')
    await sql`UPDATE cc_card_templates SET status = 'archived', updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function deleteAsset(sql, body, canApprove, event) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')

    const [asset] = await sql`SELECT * FROM cc_asset_library WHERE id = ${id}`
    if (!asset) return err('Asset not found', 404)

    try {
        const bucket = event.env.TEAM_ICONS
        const { deleteR2Object } = await import('../lib/r2.js')
        await deleteR2Object(bucket, asset.url)
        if (asset.thumbnail_url) await deleteR2Object(bucket, asset.thumbnail_url)
    } catch { /* best-effort */ }

    await sql`DELETE FROM cc_asset_library WHERE id = ${id}`
    return ok({ success: true })
}

export const onRequest = adapt(handler)

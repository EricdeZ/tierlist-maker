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
            case 'collections': return getCollections(sql, user, canApprove)
            case 'collection': return getCollection(sql, event, user, canApprove)
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
            case 'save-collection': return saveCollection(sql, body, user, canApprove)
            case 'add-collection-entries': return addCollectionEntries(sql, body, user, canApprove)
            case 'remove-collection-entry': return removeCollectionEntry(sql, body, canApprove)
            case 'collection-status': return setCollectionStatus(sql, body, canApprove)
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
            SELECT t.*, u.discord_username AS creator_name
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
            SELECT t.*, u.discord_username AS creator_name
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
            SELECT d.*, u.discord_username AS creator_name
            FROM cc_card_drafts d
            LEFT JOIN users u ON u.id = d.created_by
            WHERE (${status || null}::text IS NULL OR d.status = ${status})
              AND (${rarity || null}::text IS NULL OR d.rarity = ${rarity})
              AND (${creator ? parseInt(creator) : null}::int IS NULL OR d.created_by = ${creator ? parseInt(creator) : 0})
            ORDER BY d.updated_at DESC
        `
    } else {
        rows = await sql`
            SELECT d.*, u.discord_username AS creator_name
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

    // Auto-increment footer counters
    const td = typeof rows[0].template_data === 'string' ? JSON.parse(rows[0].template_data) : rows[0].template_data
    if (td?.elements) {
        let changed = false
        for (const el of td.elements) {
            if (el.type !== 'footer' || !el.rightText) continue
            const label = el.rightText.toUpperCase()
            const pad = el.counterPad ?? 3
            // Atomically get-and-increment the counter for this label
            const [counter] = await sql`
                INSERT INTO cc_footer_counters (label, next_serial)
                VALUES (${label}, 2)
                ON CONFLICT (label) DO UPDATE SET next_serial = cc_footer_counters.next_serial + 1
                RETURNING next_serial - 1 AS serial
            `
            el.leftText = `#${String(counter.serial).padStart(pad, '0')}`
            changed = true
        }
        if (changed) {
            await sql`UPDATE ${sql(table)} SET template_data = ${JSON.stringify(td)}, status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
            return ok({ success: true })
        }
    }

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

// ─── Collection Handlers ───

async function getCollections(sql) {
    const rows = await sql`
        SELECT c.*, u.discord_username AS creator_name,
               COUNT(e.id)::int AS entry_count
        FROM cc_collections c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN cc_collection_entries e ON e.collection_id = c.id
        GROUP BY c.id, u.discord_username
        ORDER BY c.updated_at DESC
    `
    return ok({ collections: rows })
}

async function getCollection(sql, event) {
    const { id } = event.queryStringParameters || {}
    if (!id) return err('Missing id')
    const [collection] = await sql`SELECT * FROM cc_collections WHERE id = ${id}`
    if (!collection) return err('Not found', 404)
    const entries = await sql`
        SELECT e.*, t.name AS template_name, t.card_type, t.rarity, t.thumbnail_url,
               t.template_data, u.discord_username AS added_by_name
        FROM cc_collection_entries e
        JOIN cc_card_templates t ON e.template_id = t.id
        LEFT JOIN users u ON e.added_by = u.id
        WHERE e.collection_id = ${id}
        ORDER BY e.added_at DESC
    `
    return ok({ collection, entries })
}

async function saveCollection(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id, name, description, cover_image_url } = body
    if (!name?.trim()) return err('Name required')
    if (id) {
        const [row] = await sql`
            UPDATE cc_collections SET name = ${name.trim()}, description = ${description || null},
                cover_image_url = ${cover_image_url || null}, updated_at = NOW()
            WHERE id = ${id} RETURNING *
        `
        return ok({ collection: row })
    }
    const [row] = await sql`
        INSERT INTO cc_collections (name, description, cover_image_url, created_by)
        VALUES (${name.trim()}, ${description || null}, ${cover_image_url || null}, ${user.id})
        RETURNING *
    `
    return ok({ collection: row })
}

async function addCollectionEntries(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { collection_id, template_ids } = body
    if (!collection_id || !template_ids?.length) return err('Missing collection_id or template_ids')
    const approved = await sql`
        SELECT id FROM cc_card_templates WHERE id = ANY(${template_ids}) AND status = 'approved'
    `
    const approvedIds = approved.map(r => r.id)
    if (approvedIds.length === 0) return err('No approved templates found')
    for (const tid of approvedIds) {
        await sql`
            INSERT INTO cc_collection_entries (collection_id, template_id, added_by)
            VALUES (${collection_id}, ${tid}, ${user.id})
            ON CONFLICT (collection_id, template_id) DO NOTHING
        `
    }
    return ok({ added: approvedIds.length })
}

async function removeCollectionEntry(sql, body, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id } = body
    if (!id) return err('Missing id')
    await sql`DELETE FROM cc_collection_entries WHERE id = ${id}`
    return ok({ removed: true })
}

async function setCollectionStatus(sql, body, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id, status } = body
    if (!id || !['draft', 'active', 'archived'].includes(status)) return err('Invalid params')
    const [row] = await sql`
        UPDATE cc_collections SET status = ${status}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    return ok({ collection: row })
}

export const onRequest = adapt(handler)

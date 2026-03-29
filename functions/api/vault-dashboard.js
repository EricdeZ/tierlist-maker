// Vault Dashboard API — card blueprints, assets, collections management
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
            case 'blueprints':
            case 'templates': // alias
            case 'drafts':    // alias
                return getBlueprints(sql, event, user, canApprove)
            case 'blueprint':
            case 'template':  // alias
            case 'draft':     // alias
                return getBlueprint(sql, event, user, canApprove)
            case 'search-users': return searchUsers(sql, event)
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
            case 'save-blueprint':
            case 'save-template': // alias
            case 'save-draft':    // alias
                return saveBlueprint(sql, body, user, canApprove)
            case 'submit-for-review': return submitForReview(sql, body, user)
            case 'approve': return approveItem(sql, body, user, canApprove)
            case 'reject': return rejectItem(sql, body, user, canApprove)
            case 'archive':
            case 'archive-template': // alias
                return archiveBlueprint(sql, body, canApprove)
            case 'delete-item': return deleteBlueprint(sql, body, user, canApprove)
            case 'rename-item': return renameBlueprint(sql, body, user, canApprove)
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

async function getBlueprints(sql, event, user, canApprove) {
    const { status, rarity, card_type, creator } = event.queryStringParameters || {}
    let rows
    if (canApprove) {
        rows = await sql`
            SELECT bp.*, u.discord_username AS creator_name,
                   du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
                   du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
            FROM cc_card_blueprints bp
            LEFT JOIN users u ON u.id = bp.created_by
            LEFT JOIN users du ON du.id = bp.depicted_user_id
            LEFT JOIN players dp ON dp.id = du.linked_player_id
            WHERE (${status || null}::text IS NULL OR bp.status = ${status})
              AND (${rarity || null}::text IS NULL OR bp.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR bp.card_type = ${card_type})
              AND (${creator ? parseInt(creator) : null}::int IS NULL OR bp.created_by = ${creator ? parseInt(creator) : 0})
            ORDER BY bp.updated_at DESC
        `
    } else {
        rows = await sql`
            SELECT bp.*, u.discord_username AS creator_name,
                   du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
                   du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
            FROM cc_card_blueprints bp
            LEFT JOIN users u ON u.id = bp.created_by
            LEFT JOIN users du ON du.id = bp.depicted_user_id
            LEFT JOIN players dp ON dp.id = du.linked_player_id
            WHERE bp.created_by = ${user.id}
              AND (${status || null}::text IS NULL OR bp.status = ${status})
              AND (${rarity || null}::text IS NULL OR bp.rarity = ${rarity})
              AND (${card_type || null}::text IS NULL OR bp.card_type = ${card_type})
            ORDER BY bp.updated_at DESC
        `
    }
    return ok({ blueprints: rows })
}

async function getBlueprint(sql, event, user, canApprove) {
    const id = parseInt(event.queryStringParameters?.id)
    if (!id) return err('id required')
    const [row] = await sql`
        SELECT bp.*, du.discord_username AS depicted_username, du.discord_avatar AS depicted_avatar,
               du.discord_id AS depicted_discord_id, dp.name AS depicted_player_name
        FROM cc_card_blueprints bp
        LEFT JOIN users du ON du.id = bp.depicted_user_id
        LEFT JOIN players dp ON dp.id = du.linked_player_id
        WHERE bp.id = ${id}
    `
    if (!row) return err('Blueprint not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)
    return ok({ blueprint: row })
}

async function searchUsers(sql, event) {
    const { q } = event.queryStringParameters || {}
    if (!q || q.trim().length < 2) return ok({ users: [] })
    const query = q.trim()
    const results = await sql`
        SELECT u.id, u.discord_username, u.discord_avatar, u.discord_id, p.name AS player_name
        FROM users u
        LEFT JOIN players p ON p.id = u.linked_player_id
        WHERE u.discord_username ILIKE ${'%' + query + '%'}
           OR p.name ILIKE ${'%' + query + '%'}
        ORDER BY u.discord_username ASC
        LIMIT 10
    `
    return ok({ users: results })
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
    const [usage] = await sql`
        SELECT COUNT(*) AS count FROM cc_card_blueprints
        WHERE template_data::text LIKE ${'%' + id + '%'}
    `
    return ok({ asset: row, usageCount: parseInt(usage.count) })
}

// ─── POST Handlers ───

async function saveBlueprint(sql, body, user, canApprove) {
    const { id, name, description, card_type, rarity, template_data, target_player_id, depicted_user_id } = body
    if (!card_type || !rarity || !template_data) return err('card_type, rarity, template_data required')

    // Banner playerName is the source of truth for the display name
    const td = template_data || {}
    const banner = td.elements?.find(el => el.type === 'name-banner')
    const bannerName = banner?.playerName && banner.playerName !== 'Player Name' ? banner.playerName : null
    const resolvedName = bannerName || name || 'Card'

    let resolvedTargetPlayerId = target_player_id || null
    if (depicted_user_id && !target_player_id) {
        const [depictedUser] = await sql`SELECT linked_player_id FROM users WHERE id = ${depicted_user_id}`
        if (depictedUser?.linked_player_id) resolvedTargetPlayerId = depictedUser.linked_player_id
    }

    if (id) {
        const [existing] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
        if (!existing) return err('Blueprint not found', 404)
        if (!canApprove && existing.created_by !== user.id) return err('Not authorized', 403)
        if (!canApprove && existing.status !== 'draft' && existing.status !== 'rejected') return err('Can only edit drafts or rejected blueprints')

        const [row] = await sql`
            UPDATE cc_card_blueprints
            SET name = ${resolvedName.trim()}, description = ${description || null}, card_type = ${card_type},
                rarity = ${rarity}, template_data = ${JSON.stringify(template_data)},
                target_player_id = ${resolvedTargetPlayerId},
                depicted_user_id = ${depicted_user_id !== undefined ? (depicted_user_id || null) : existing.depicted_user_id},
                status = ${existing.status === 'rejected' ? 'draft' : existing.status},
                rejection_reason = ${existing.status === 'rejected' ? null : existing.rejection_reason},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `
        return ok({ blueprint: row })
    } else {
        const [row] = await sql`
            INSERT INTO cc_card_blueprints (name, description, card_type, rarity, template_data, target_player_id, created_by, depicted_user_id, source)
            VALUES (${resolvedName.trim()}, ${description || null}, ${card_type}, ${rarity}, ${JSON.stringify(template_data)}, ${resolvedTargetPlayerId}, ${user.id}, ${depicted_user_id || null}, 'blueprint')
            RETURNING *
        `
        return ok({ blueprint: row })
    }
}

async function submitForReview(sql, body, user) {
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.created_by !== user.id) return err('Not authorized', 403)
    if (row.status !== 'draft' && row.status !== 'rejected') return err('Only drafts or rejected items can be submitted')

    await sql`UPDATE cc_card_blueprints SET status = 'pending_review', rejection_reason = NULL, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function approveItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review' && row.status !== 'draft') return err('Only pending or draft items can be approved')

    // Auto-increment footer counters
    const td = typeof row.template_data === 'string' ? JSON.parse(row.template_data) : row.template_data
    if (td?.elements) {
        let changed = false
        for (const el of td.elements) {
            if (el.type !== 'footer' || !el.rightText) continue
            const label = el.rightText.toUpperCase()
            const pad = el.counterPad ?? 3
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
            await sql`UPDATE cc_card_blueprints SET template_data = ${JSON.stringify(td)}, status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
            return ok({ success: true })
        }
    }

    await sql`UPDATE cc_card_blueprints SET status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function rejectItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id, reason } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review') return err('Only pending items can be rejected')

    await sql`UPDATE cc_card_blueprints SET status = 'rejected', rejection_reason = ${reason || null}, updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function archiveBlueprint(sql, body, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { id } = body
    if (!id) return err('id required')
    await sql`UPDATE cc_card_blueprints SET status = 'archived', updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function deleteBlueprint(sql, body, user, canApprove) {
    const { id } = body
    if (!id) return err('id required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)

    await sql`DELETE FROM cc_card_blueprints WHERE id = ${id}`
    return ok({ success: true })
}

async function renameBlueprint(sql, body, user, canApprove) {
    const { id, name } = body
    if (!id) return err('id required')
    if (!name?.trim()) return err('name required')

    const [row] = await sql`SELECT * FROM cc_card_blueprints WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (!canApprove && row.created_by !== user.id) return err('Not authorized', 403)

    await sql`UPDATE cc_card_blueprints SET name = ${name.trim()}, updated_at = NOW() WHERE id = ${id}`
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
        SELECT e.*, bp.name AS template_name,
               bp.card_type, bp.rarity, bp.thumbnail_url, bp.template_data,
               u.discord_username AS added_by_name
        FROM cc_collection_entries e
        JOIN cc_card_blueprints bp ON e.blueprint_id = bp.id
        LEFT JOIN users u ON e.added_by = u.id
        WHERE e.collection_id = ${id}
        ORDER BY e.added_at DESC
    `
    return ok({ collection, entries })
}

function toSlug(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

async function saveCollection(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { id, name, description, cover_image_url } = body
    if (!name?.trim()) return err('Name required')
    const slug = toSlug(name)
    if (id) {
        const [row] = await sql`
            UPDATE cc_collections SET name = ${name.trim()}, description = ${description || null},
                cover_image_url = ${cover_image_url || null}, slug = ${slug}, updated_at = NOW()
            WHERE id = ${id} RETURNING *
        `
        return ok({ collection: row })
    }
    const [row] = await sql`
        INSERT INTO cc_collections (name, description, cover_image_url, slug, created_by)
        VALUES (${name.trim()}, ${description || null}, ${cover_image_url || null}, ${slug}, ${user.id})
        RETURNING *
    `
    return ok({ collection: row })
}

async function addCollectionEntries(sql, body, user, canApprove) {
    if (!canApprove) return err('Requires vault_approve', 403)
    const { collection_id, blueprint_ids, template_ids, draft_ids } = body

    // Support both new (blueprint_ids) and old (template_ids/draft_ids) API
    let ids = blueprint_ids || []
    if (!ids.length && (template_ids?.length || draft_ids?.length)) {
        // Legacy: look up blueprint_ids from old template/draft IDs
        if (template_ids?.length) {
            const rows = await sql`SELECT id FROM cc_card_blueprints WHERE legacy_template_id = ANY(${template_ids}) AND source = 'template'`
            ids.push(...rows.map(r => r.id))
        }
        if (draft_ids?.length) {
            const rows = await sql`SELECT id FROM cc_card_blueprints WHERE legacy_draft_id = ANY(${draft_ids}) AND source = 'draft'`
            ids.push(...rows.map(r => r.id))
        }
    }

    if (!collection_id || !ids.length) return err('Missing collection_id or blueprint_ids')
    let added = 0
    const approved = await sql`
        SELECT id FROM cc_card_blueprints WHERE id = ANY(${ids}) AND status = 'approved'
    `
    for (const { id } of approved) {
        await sql`
            INSERT INTO cc_collection_entries (collection_id, blueprint_id, added_by)
            VALUES (${collection_id}, ${id}, ${user.id})
            ON CONFLICT DO NOTHING
        `
        added++
    }
    if (added === 0) return err('No approved blueprints found')
    return ok({ added })
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

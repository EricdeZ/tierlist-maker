import { adapt } from '../lib/adapter.js'
import { getDB, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field'
}

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'codex_edit')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        // GET: Return all fields, tags, and items
        if (event.httpMethod === 'GET') {
            const fields = await sql`SELECT * FROM codex_fields ORDER BY sort_order, id`
            const tags = await sql`SELECT * FROM codex_tags ORDER BY name`
            const items = await sql`SELECT * FROM codex_items ORDER BY name`
            const itemTags = await sql`SELECT item_id, tag_id FROM codex_item_tags`

            // Attach tag_ids array to each item
            const tagMap = {}
            for (const it of itemTags) {
                if (!tagMap[it.item_id]) tagMap[it.item_id] = []
                tagMap[it.item_id].push(it.tag_id)
            }
            const itemsWithTags = items.map(i => ({ ...i, tag_ids: tagMap[i.id] || [] }))

            return { statusCode: 200, headers, body: JSON.stringify({ fields, tags, items: itemsWithTags }) }
        }

        // POST: CRUD actions
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
        }
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
        }

        let body
        try { body = JSON.parse(event.body) } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
        }

        switch (body.action) {
            // Fields
            case 'create-field': return await createField(sql, body, admin)
            case 'update-field': return await updateField(sql, body, admin)
            case 'delete-field': return await deleteField(sql, body, admin)
            // Tags
            case 'create-tag': return await createTag(sql, body, admin)
            case 'update-tag': return await updateTag(sql, body, admin)
            case 'delete-tag': return await deleteTag(sql, body, admin)
            // Items
            case 'create-item': return await createItem(sql, body, admin)
            case 'update-item': return await updateItem(sql, body, admin)
            case 'delete-item': return await deleteItem(sql, body, admin)
            // Images
            case 'update-image-category': return await updateImageCategory(sql, body, admin)
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
        }
    } catch (error) {
        console.error('Codex manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal server error' }) }
    }
}

// ── Fields ──

async function createField(sql, { name, slug, icon_url, description, field_type, required, sort_order }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const finalSlug = slug?.trim() ? slugify(slug.trim()) : slugify(name.trim())
    const type = ['text', 'number'].includes(field_type) ? field_type : 'text'
    const [row] = await sql`
        INSERT INTO codex_fields (slug, name, icon_url, description, field_type, required, sort_order)
        VALUES (${finalSlug}, ${name.trim()}, ${icon_url || null}, ${description || null}, ${type}, ${!!required}, ${sort_order ?? 0})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-field', endpoint: 'codex-manage', targetType: 'codex_field', targetId: row.id, details: { name: row.name, slug: row.slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, field: row }) }
}

async function updateField(sql, { id, name, slug, icon_url, description, field_type, required, sort_order }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (slug !== undefined) updates.slug = slugify(slug.trim())
    if (icon_url !== undefined) updates.icon_url = icon_url || null
    if (description !== undefined) updates.description = description || null
    if (field_type !== undefined && ['text', 'number'].includes(field_type)) updates.field_type = field_type
    if (required !== undefined) updates.required = !!required
    if (sort_order !== undefined) updates.sort_order = sort_order

    const [row] = await sql`
        UPDATE codex_fields SET
            name = COALESCE(${updates.name ?? null}, name),
            slug = COALESCE(${updates.slug ?? null}, slug),
            icon_url = ${updates.icon_url !== undefined ? updates.icon_url : null},
            description = ${updates.description !== undefined ? updates.description : null},
            field_type = COALESCE(${updates.field_type ?? null}, field_type),
            required = COALESCE(${updates.required ?? null}, required),
            sort_order = COALESCE(${updates.sort_order ?? null}, sort_order)
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Field not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-field', endpoint: 'codex-manage', targetType: 'codex_field', targetId: id, details: updates })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, field: row }) }
}

async function deleteField(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_fields WHERE id = ${id} RETURNING id, name, slug`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Field not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-field', endpoint: 'codex-manage', targetType: 'codex_field', targetId: id, details: { name: row.name, slug: row.slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── Tags ──

async function createTag(sql, { name, color }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const [row] = await sql`
        INSERT INTO codex_tags (name, color)
        VALUES (${name.trim()}, ${color || null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-tag', endpoint: 'codex-manage', targetType: 'codex_tag', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tag: row }) }
}

async function updateTag(sql, { id, name, color }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE codex_tags SET
            name = COALESCE(${name?.trim() || null}, name),
            color = COALESCE(${color || null}, color)
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tag not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-tag', endpoint: 'codex-manage', targetType: 'codex_tag', targetId: id, details: { name, color } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tag: row }) }
}

async function deleteTag(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_tags WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tag not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-tag', endpoint: 'codex-manage', targetType: 'codex_tag', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── Items ──

async function createItem(sql, { name, description, icon_url, field_values, tag_ids }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }

    // Validate required fields
    const validationError = await validateRequiredFields(sql, field_values || {})
    if (validationError) return validationError

    const [row] = await sql`
        INSERT INTO codex_items (name, description, icon_url, field_values)
        VALUES (${name.trim()}, ${description || null}, ${icon_url || null}, ${JSON.stringify(field_values || {})})
        RETURNING *
    `

    // Insert tag associations
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
        for (const tagId of tag_ids) {
            await sql`INSERT INTO codex_item_tags (item_id, tag_id) VALUES (${row.id}, ${tagId}) ON CONFLICT DO NOTHING`
        }
    }

    await logAudit(sql, admin, { action: 'create-codex-item', endpoint: 'codex-manage', targetType: 'codex_item', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, item: { ...row, tag_ids: tag_ids || [] } }) }
}

async function updateItem(sql, { id, name, description, icon_url, field_values, tag_ids }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }

    // Validate required fields if field_values provided
    if (field_values !== undefined) {
        const validationError = await validateRequiredFields(sql, field_values || {})
        if (validationError) return validationError
    }

    const [row] = await sql`
        UPDATE codex_items SET
            name = COALESCE(${name?.trim() || null}, name),
            description = ${description !== undefined ? (description || null) : null},
            icon_url = ${icon_url !== undefined ? (icon_url || null) : null},
            field_values = COALESCE(${field_values !== undefined ? JSON.stringify(field_values) : null}, field_values),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Item not found' }) }

    // Replace tag associations if provided
    if (Array.isArray(tag_ids)) {
        await sql`DELETE FROM codex_item_tags WHERE item_id = ${id}`
        for (const tagId of tag_ids) {
            await sql`INSERT INTO codex_item_tags (item_id, tag_id) VALUES (${id}, ${tagId}) ON CONFLICT DO NOTHING`
        }
    }

    await logAudit(sql, admin, { action: 'update-codex-item', endpoint: 'codex-manage', targetType: 'codex_item', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, item: { ...row, tag_ids: tag_ids || [] } }) }
}

async function deleteItem(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_items WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Item not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-item', endpoint: 'codex-manage', targetType: 'codex_item', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── Images ──

async function updateImageCategory(sql, { id, category }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE codex_images SET category = ${category || null}
        WHERE id = ${id} RETURNING id, filename, category
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Image not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-image-category', endpoint: 'codex-manage', targetType: 'codex_image', targetId: id, details: { category } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, image: row }) }
}

// ── Helpers ──

async function validateRequiredFields(sql, fieldValues) {
    const required = await sql`SELECT slug, name FROM codex_fields WHERE required = true`
    const missing = required.filter(f => !fieldValues[f.slug] && fieldValues[f.slug] !== 0)
    if (missing.length > 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Missing required fields: ${missing.map(f => f.name).join(', ')}` }) }
    }
    return null
}

export const onRequest = adapt(handler)

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
        // GET: Return all fields, tags, and items (or gods if ?type=gods)
        if (event.httpMethod === 'GET') {
            const type = (event.queryStringParameters || {}).type

            if (type === 'gods') {
                const fields = await sql`SELECT * FROM codex_god_fields ORDER BY sort_order, id`
                const tags = await sql`SELECT * FROM codex_god_tags ORDER BY name`
                const gods = await sql`SELECT * FROM codex_gods ORDER BY name`
                const godTags = await sql`SELECT god_id, tag_id FROM codex_god_tag_assignments`
                const linkedGods = await sql`SELECT id, name, slug, image_url FROM gods ORDER BY name`

                const tagMap = {}
                for (const gt of godTags) {
                    if (!tagMap[gt.god_id]) tagMap[gt.god_id] = []
                    tagMap[gt.god_id].push(gt.tag_id)
                }
                const godsWithTags = gods.map(g => ({ ...g, tag_ids: tagMap[g.id] || [] }))

                // Gallery: categories + god-image associations
                const categories = await sql`SELECT * FROM codex_god_categories ORDER BY sort_order, id`
                const godImages = await sql`
                    SELECT gi.id, gi.codex_god_id, gi.codex_image_id, gi.category_id, gi.caption, gi.sort_order,
                           ci.filename, ci.url
                    FROM codex_god_images gi
                    JOIN codex_images ci ON ci.id = gi.codex_image_id
                    ORDER BY gi.sort_order, gi.id
                `

                return { statusCode: 200, headers, body: JSON.stringify({ fields, tags, gods: godsWithTags, linkedGods, categories, godImages }) }
            }

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
            // God Fields
            case 'create-god-field': return await createGodField(sql, body, admin)
            case 'update-god-field': return await updateGodField(sql, body, admin)
            case 'delete-god-field': return await deleteGodField(sql, body, admin)
            // God Tags
            case 'create-god-tag': return await createGodTag(sql, body, admin)
            case 'update-god-tag': return await updateGodTag(sql, body, admin)
            case 'delete-god-tag': return await deleteGodTag(sql, body, admin)
            // Gods
            case 'create-god': return await createGod(sql, body, admin)
            case 'update-god': return await updateGod(sql, body, admin)
            case 'delete-god': return await deleteGod(sql, body, admin)
            // God Categories
            case 'create-god-category': return await createGodCategory(sql, body, admin)
            case 'update-god-category': return await updateGodCategory(sql, body, admin)
            case 'delete-god-category': return await deleteGodCategory(sql, body, admin)
            case 'reorder-god-categories': return await reorderGodCategories(sql, body, admin)
            // God Images (gallery)
            case 'add-god-image': return await addGodImage(sql, body, admin)
            case 'remove-god-image': return await removeGodImage(sql, body, admin)
            case 'reorder-god-images': return await reorderGodImages(sql, body, admin)
            case 'update-god-image': return await updateGodImageCaption(sql, body, admin)
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

async function createField(sql, { name, slug, icon_url, description, field_type, required, sort_order, options }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const finalSlug = slug?.trim() ? slugify(slug.trim()) : slugify(name.trim())
    const type = ['text', 'number', 'group'].includes(field_type) ? field_type : 'text'
    const finalOptions = type === 'group' ? validateGroupOptions(options) : null
    const [row] = await sql`
        INSERT INTO codex_fields (slug, name, icon_url, description, field_type, required, sort_order, options)
        VALUES (${finalSlug}, ${name.trim()}, ${icon_url || null}, ${description || null}, ${type}, ${!!required}, ${sort_order ?? 0}, ${finalOptions ? JSON.stringify(finalOptions) : null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-field', endpoint: 'codex-manage', targetType: 'codex_field', targetId: row.id, details: { name: row.name, slug: row.slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, field: row }) }
}

async function updateField(sql, { id, name, slug, icon_url, description, field_type, required, sort_order, options }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (slug !== undefined) updates.slug = slugify(slug.trim())
    if (icon_url !== undefined) updates.icon_url = icon_url || null
    if (description !== undefined) updates.description = description || null
    if (field_type !== undefined && ['text', 'number', 'group'].includes(field_type)) updates.field_type = field_type
    if (required !== undefined) updates.required = !!required
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (options !== undefined) updates.options = updates.field_type === 'group' || field_type === 'group' ? JSON.stringify(validateGroupOptions(options)) : null

    const [row] = await sql`
        UPDATE codex_fields SET
            name = COALESCE(${updates.name ?? null}, name),
            slug = COALESCE(${updates.slug ?? null}, slug),
            icon_url = ${updates.icon_url !== undefined ? updates.icon_url : null},
            description = ${updates.description !== undefined ? updates.description : null},
            field_type = COALESCE(${updates.field_type ?? null}, field_type),
            required = COALESCE(${updates.required ?? null}, required),
            sort_order = COALESCE(${updates.sort_order ?? null}, sort_order),
            options = COALESCE(${updates.options !== undefined ? updates.options : null}::jsonb, options)
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

// ── God Fields ──

async function createGodField(sql, { name, slug, icon_url, description, field_type, required, sort_order, options }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const finalSlug = slug?.trim() ? slugify(slug.trim()) : slugify(name.trim())
    const type = ['text', 'number', 'group'].includes(field_type) ? field_type : 'text'
    const finalOptions = type === 'group' ? validateGroupOptions(options) : null
    const [row] = await sql`
        INSERT INTO codex_god_fields (slug, name, icon_url, description, field_type, required, sort_order, options)
        VALUES (${finalSlug}, ${name.trim()}, ${icon_url || null}, ${description || null}, ${type}, ${!!required}, ${sort_order ?? 0}, ${finalOptions ? JSON.stringify(finalOptions) : null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-god-field', endpoint: 'codex-manage', targetType: 'codex_god_field', targetId: row.id, details: { name: row.name, slug: row.slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, field: row }) }
}

async function updateGodField(sql, { id, name, slug, icon_url, description, field_type, required, sort_order, options }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (slug !== undefined) updates.slug = slugify(slug.trim())
    if (icon_url !== undefined) updates.icon_url = icon_url || null
    if (description !== undefined) updates.description = description || null
    if (field_type !== undefined && ['text', 'number', 'group'].includes(field_type)) updates.field_type = field_type
    if (required !== undefined) updates.required = !!required
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (options !== undefined) updates.options = updates.field_type === 'group' || field_type === 'group' ? JSON.stringify(validateGroupOptions(options)) : null

    const [row] = await sql`
        UPDATE codex_god_fields SET
            name = COALESCE(${updates.name ?? null}, name),
            slug = COALESCE(${updates.slug ?? null}, slug),
            icon_url = ${updates.icon_url !== undefined ? updates.icon_url : null},
            description = ${updates.description !== undefined ? updates.description : null},
            field_type = COALESCE(${updates.field_type ?? null}, field_type),
            required = COALESCE(${updates.required ?? null}, required),
            sort_order = COALESCE(${updates.sort_order ?? null}, sort_order),
            options = COALESCE(${updates.options !== undefined ? updates.options : null}::jsonb, options)
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Field not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-god-field', endpoint: 'codex-manage', targetType: 'codex_god_field', targetId: id, details: updates })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, field: row }) }
}

async function deleteGodField(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_god_fields WHERE id = ${id} RETURNING id, name, slug`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Field not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-god-field', endpoint: 'codex-manage', targetType: 'codex_god_field', targetId: id, details: { name: row.name, slug: row.slug } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── God Tags ──

async function createGodTag(sql, { name, color }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const [row] = await sql`
        INSERT INTO codex_god_tags (name, color)
        VALUES (${name.trim()}, ${color || null})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-god-tag', endpoint: 'codex-manage', targetType: 'codex_god_tag', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tag: row }) }
}

async function updateGodTag(sql, { id, name, color }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE codex_god_tags SET
            name = COALESCE(${name?.trim() || null}, name),
            color = COALESCE(${color || null}, color)
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tag not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-god-tag', endpoint: 'codex-manage', targetType: 'codex_god_tag', targetId: id, details: { name, color } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tag: row }) }
}

async function deleteGodTag(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_god_tags WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tag not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-god-tag', endpoint: 'codex-manage', targetType: 'codex_god_tag', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── Gods ──

async function createGod(sql, { name, description, icon_url, god_id, field_values, tag_ids }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }

    const validationError = await validateRequiredGodFields(sql, field_values || {})
    if (validationError) return validationError

    const [row] = await sql`
        INSERT INTO codex_gods (name, description, icon_url, god_id, field_values)
        VALUES (${name.trim()}, ${description || null}, ${icon_url || null}, ${god_id || null}, ${JSON.stringify(field_values || {})})
        RETURNING *
    `

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
        for (const tagId of tag_ids) {
            await sql`INSERT INTO codex_god_tag_assignments (god_id, tag_id) VALUES (${row.id}, ${tagId}) ON CONFLICT DO NOTHING`
        }
    }

    await logAudit(sql, admin, { action: 'create-codex-god', endpoint: 'codex-manage', targetType: 'codex_god', targetId: row.id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, god: { ...row, tag_ids: tag_ids || [] } }) }
}

async function updateGod(sql, { id, name, description, icon_url, god_id, field_values, tag_ids }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }

    if (field_values !== undefined) {
        const validationError = await validateRequiredGodFields(sql, field_values || {})
        if (validationError) return validationError
    }

    const [row] = await sql`
        UPDATE codex_gods SET
            name = COALESCE(${name?.trim() || null}, name),
            description = ${description !== undefined ? (description || null) : null},
            icon_url = ${icon_url !== undefined ? (icon_url || null) : null},
            god_id = ${god_id !== undefined ? (god_id || null) : null},
            field_values = COALESCE(${field_values !== undefined ? JSON.stringify(field_values) : null}, field_values),
            updated_at = NOW()
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'God not found' }) }

    if (Array.isArray(tag_ids)) {
        await sql`DELETE FROM codex_god_tag_assignments WHERE god_id = ${id}`
        for (const tagId of tag_ids) {
            await sql`INSERT INTO codex_god_tag_assignments (god_id, tag_id) VALUES (${id}, ${tagId}) ON CONFLICT DO NOTHING`
        }
    }

    await logAudit(sql, admin, { action: 'update-codex-god', endpoint: 'codex-manage', targetType: 'codex_god', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, god: { ...row, tag_ids: tag_ids || [] } }) }
}

async function deleteGod(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_gods WHERE id = ${id} RETURNING id, name`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'God not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-god', endpoint: 'codex-manage', targetType: 'codex_god', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

// ── God Categories ──

async function createGodCategory(sql, { name, slug, parent_id, sort_order }, admin) {
    if (!name?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) }
    const finalSlug = slug?.trim() ? slugify(slug.trim()) : slugify(name.trim())
    const [row] = await sql`
        INSERT INTO codex_god_categories (name, slug, parent_id, sort_order)
        VALUES (${name.trim()}, ${finalSlug}, ${parent_id || null}, ${sort_order ?? 0})
        RETURNING *
    `
    await logAudit(sql, admin, { action: 'create-codex-god-category', endpoint: 'codex-manage', targetType: 'codex_god_category', targetId: row.id, details: { name: row.name, slug: row.slug, parent_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, category: row }) }
}

async function updateGodCategory(sql, { id, name, slug, parent_id, sort_order }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    if (parent_id === id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Category cannot be its own parent' }) }
    const [row] = await sql`
        UPDATE codex_god_categories SET
            name = COALESCE(${name?.trim() || null}, name),
            slug = COALESCE(${slug?.trim() ? slugify(slug.trim()) : null}, slug),
            parent_id = ${parent_id !== undefined ? (parent_id || null) : null},
            sort_order = COALESCE(${sort_order ?? null}, sort_order)
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Category not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-god-category', endpoint: 'codex-manage', targetType: 'codex_god_category', targetId: id, details: { name, slug, parent_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, category: row }) }
}

async function deleteGodCategory(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_god_categories WHERE id = ${id} RETURNING id, name, slug`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Category not found' }) }
    await logAudit(sql, admin, { action: 'delete-codex-god-category', endpoint: 'codex-manage', targetType: 'codex_god_category', targetId: id, details: { name: row.name } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

async function reorderGodCategories(sql, { items }, admin) {
    if (!Array.isArray(items)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'items array required' }) }
    for (const { id, sort_order } of items) {
        await sql`UPDATE codex_god_categories SET sort_order = ${sort_order} WHERE id = ${id}`
    }
    await logAudit(sql, admin, { action: 'reorder-codex-god-categories', endpoint: 'codex-manage', targetType: 'codex_god_category', details: { count: items.length } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

// ── God Images (gallery) ──

async function addGodImage(sql, { codex_god_id, codex_image_id, category_id, caption, sort_order }, admin) {
    if (!codex_god_id || !codex_image_id || !category_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'codex_god_id, codex_image_id, and category_id required' }) }
    }
    const [row] = await sql`
        INSERT INTO codex_god_images (codex_god_id, codex_image_id, category_id, caption, sort_order)
        VALUES (${codex_god_id}, ${codex_image_id}, ${category_id}, ${caption || null}, ${sort_order ?? 0})
        ON CONFLICT (codex_god_id, codex_image_id, category_id) DO NOTHING
        RETURNING *
    `
    if (!row) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Image already in this category for this god' }) }
    await logAudit(sql, admin, { action: 'add-codex-god-image', endpoint: 'codex-manage', targetType: 'codex_god_image', targetId: row.id, details: { codex_god_id, codex_image_id, category_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, godImage: row }) }
}

async function removeGodImage(sql, { id }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`DELETE FROM codex_god_images WHERE id = ${id} RETURNING id, codex_god_id, codex_image_id, category_id`
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'God image not found' }) }
    await logAudit(sql, admin, { action: 'remove-codex-god-image', endpoint: 'codex-manage', targetType: 'codex_god_image', targetId: id, details: { codex_god_id: row.codex_god_id } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: row }) }
}

async function reorderGodImages(sql, { items }, admin) {
    if (!Array.isArray(items)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'items array required' }) }
    for (const { id, sort_order } of items) {
        await sql`UPDATE codex_god_images SET sort_order = ${sort_order} WHERE id = ${id}`
    }
    await logAudit(sql, admin, { action: 'reorder-codex-god-images', endpoint: 'codex-manage', targetType: 'codex_god_image', details: { count: items.length } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}

async function updateGodImageCaption(sql, { id, caption }, admin) {
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) }
    const [row] = await sql`
        UPDATE codex_god_images SET caption = ${caption || null}
        WHERE id = ${id} RETURNING *
    `
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: 'God image not found' }) }
    await logAudit(sql, admin, { action: 'update-codex-god-image', endpoint: 'codex-manage', targetType: 'codex_god_image', targetId: id, details: { caption } })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, godImage: row }) }
}

// ── Helpers ──

function validateGroupOptions(options) {
    if (!options || !Array.isArray(options.sub_fields) || options.sub_fields.length === 0) return null
    const subFields = options.sub_fields
        .filter(sf => sf.key?.trim() && sf.label?.trim())
        .map(sf => ({
            key: sf.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
            label: sf.label.trim(),
            type: ['text', 'number'].includes(sf.type) ? sf.type : 'text'
        }))
    if (subFields.length === 0) return null
    const keys = new Set()
    const unique = subFields.filter(sf => { if (keys.has(sf.key)) return false; keys.add(sf.key); return true })
    return { sub_fields: unique }
}

async function validateRequiredFields(sql, fieldValues) {
    const required = await sql`SELECT slug, name, field_type FROM codex_fields WHERE required = true`
    const missing = required.filter(f => {
        const val = fieldValues[f.slug]
        if (f.field_type === 'group') {
            if (!val || typeof val !== 'object') return true
            return !Object.values(val).some(v => v !== '' && v !== null && v !== undefined)
        }
        return !val && val !== 0
    })
    if (missing.length > 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Missing required fields: ${missing.map(f => f.name).join(', ')}` }) }
    }
    return null
}

async function validateRequiredGodFields(sql, fieldValues) {
    const required = await sql`SELECT slug, name, field_type FROM codex_god_fields WHERE required = true`
    const missing = required.filter(f => {
        const val = fieldValues[f.slug]
        if (f.field_type === 'group') {
            if (!val || typeof val !== 'object') return true
            return !Object.values(val).some(v => v !== '' && v !== null && v !== undefined)
        }
        return !val && val !== 0
    })
    if (missing.length > 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Missing required fields: ${missing.map(f => f.name).join(', ')}` }) }
    }
    return null
}

export const onRequest = adapt(handler)

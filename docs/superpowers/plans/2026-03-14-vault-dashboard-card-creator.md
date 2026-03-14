# Vault Dashboard & Card Creator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a card design studio at `/vault-dashboard/*` where vault members create trading card templates (common→mythic via existing TradingCard structure) and full-art cards (layer-based composition), submit them for owner approval, and feed approved designs into the existing card generation pipeline.

**Architecture:** New top-level route section with dedicated layout (CodexLayout pattern). Two backend files: `vault-dashboard.js` (adapt-wrapped JSON API) and `vault-dashboard-upload.js` (raw onRequest for multipart uploads, codex-upload.js pattern). Three new DB tables (`cc_card_templates`, `cc_card_drafts`, `cc_asset_library`) plus two new permissions (`vault_member`, `vault_approve`). Frontend split into editor/, preview/, and management pages.

**Tech Stack:** React 19, Tailwind CSS 4, Cloudflare Pages Functions, Neon PostgreSQL, Cloudflare R2, existing TradingCard/GameCard components, Canvas API for PNG export.

**Spec:** `docs/superpowers/specs/2026-03-12-vault-dashboard-card-creator-design.md`

---

## Chunk 1: Database, Permissions & Backend Foundation

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/110-vault-dashboard.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 110-vault-dashboard.sql
-- Vault Dashboard: card templates, drafts, asset library, permissions

-- New permissions
INSERT INTO permissions (key, description) VALUES
  ('vault_member', 'Access Vault Dashboard and card creator'),
  ('vault_approve', 'Approve/reject card designs and delete assets')
ON CONFLICT (key) DO NOTHING;

-- Grant vault_member and vault_approve to Owner role
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r, (VALUES ('vault_member'), ('vault_approve')) AS p(key)
WHERE r.name = 'Owner'
ON CONFLICT DO NOTHING;

-- Card templates (reusable designs)
CREATE TABLE cc_card_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    rejection_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_templates_status ON cc_card_templates(status);
CREATE INDEX idx_cc_card_templates_created_by ON cc_card_templates(created_by);
CREATE INDEX idx_cc_card_templates_status_creator ON cc_card_templates(status, created_by);

-- Card drafts (one-off designs)
CREATE TABLE cc_card_drafts (
    id SERIAL PRIMARY KEY,
    card_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    target_player_id INTEGER,
    notes TEXT,
    rejection_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_card_drafts_status ON cc_card_drafts(status);
CREATE INDEX idx_cc_card_drafts_created_by ON cc_card_drafts(created_by);
CREATE INDEX idx_cc_card_drafts_status_creator ON cc_card_drafts(status, created_by);

-- Asset library
CREATE TABLE cc_asset_library (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_asset_library_category ON cc_asset_library(category);
CREATE INDEX idx_cc_asset_library_tags ON cc_asset_library USING GIN(tags);

-- Link approved templates to minted cards
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES cc_card_templates(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Run migration against dev database**

```bash
# Copy SQL and run against Neon dev database
# Verify tables created: \dt cc_card_templates, cc_card_drafts, cc_asset_library
# Verify permissions inserted: SELECT * FROM permissions WHERE key IN ('vault_member', 'vault_approve');
# Verify cc_cards.template_id column added
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/110-vault-dashboard.sql
git commit -m "feat(vault-dashboard): add migration for templates, drafts, assets tables and permissions"
```

---

### Task 2: Add full_art Rarity & R2 Prefix

**Files:**
- Modify: `functions/lib/vault.js` (RARITIES object, ~line 6)
- Modify: `functions/lib/r2.js` (ALLOWED_PREFIXES, line 12)

- [ ] **Step 1: Add full_art to RARITIES in vault.js**

Add after the `mythic` entry in the RARITIES object (NOT to RARITY_ORDER — full_art is never rolled from packs):

```javascript
full_art:  { name: 'Full Art',  dropRate: 0, color: '#d4af37', holoEffects: ['rainbow', 'secret', 'gold', 'cosmos', 'galaxy', 'radiant'] },
```

- [ ] **Step 2: Add vault-assets to ALLOWED_PREFIXES in r2.js**

Change line 12:
```javascript
export const ALLOWED_PREFIXES = ['team-icons/', 'codex/', 'community-teams/', 'vault-assets/']
```

- [ ] **Step 3: Add full_art to client-side RARITIES in economy.js**

In `src/data/vault/economy.js`, add to the RARITIES object:
```javascript
full_art: { tier: 0, holoEffects: ['rainbow', 'secret', 'gold', 'cosmos', 'galaxy', 'radiant'], dropRate: 0, color: '#d4af37', emberValue: 0, dismantleValue: 0, craftCost: 0 },
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/vault.js functions/lib/r2.js src/data/vault/economy.js
git commit -m "feat(vault-dashboard): add full_art rarity and vault-assets R2 prefix"
```

---

### Task 3: Backend API — vault-dashboard.js

**Files:**
- Create: `functions/api/vault-dashboard.js`

- [ ] **Step 1: Create the endpoint with GET actions**

```javascript
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
    const canApprove = await requirePermission(event, 'vault_approve').then(u => !!u).catch(() => false)

    if (event.httpMethod === 'GET') {
        switch (action) {
            case 'templates': return getTemplates(sql, event, user, canApprove)
            case 'template': return getTemplate(sql, event, user, canApprove)
            case 'drafts': return getDrafts(sql, event, user, canApprove)
            case 'draft': return getDraft(sql, event, user, canApprove)
            case 'assets': return getAssets(sql, event)
            case 'asset': return getAsset(sql, event)
            default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Unknown action' }) }
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
            default: return { statusCode: 400, headers: adminHeaders, body: JSON.stringify({ error: 'Unknown action' }) }
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
    // Usage count
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
        // Update existing
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
        // Create new
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
    const { type, id } = body // type: 'template' | 'draft'
    if (!type || !id) return err('type and id required')

    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'
    const [row] = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
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
    const [row] = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review') return err('Only pending items can be approved')

    await sql`UPDATE ${sql(table)} SET status = 'approved', approved_by = ${user.id}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id}`
    return ok({ success: true })
}

async function rejectItem(sql, body, user, canApprove) {
    if (!canApprove) return err('Not authorized', 403)
    const { type, id, reason } = body
    if (!type || !id) return err('type and id required')

    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'
    const [row] = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`
    if (!row) return err('Not found', 404)
    if (row.status !== 'pending_review') return err('Only pending items can be rejected')

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

    // Delete from R2
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
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault-dashboard.js
git commit -m "feat(vault-dashboard): add backend API endpoint for templates, drafts, assets"
```

---

### Task 4: Backend Upload Endpoint

**Files:**
- Create: `functions/api/vault-dashboard-upload.js`

- [ ] **Step 1: Create the upload endpoint (raw onRequest pattern)**

```javascript
// Vault Dashboard upload — uses raw onRequest (not adapt) for multipart form handling
// Same pattern as codex-upload.js
import { getDB } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { validateImageFile, uploadToR2, deleteR2Object, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

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

    // Generate thumbnail (store same image for now — client can send a resized version)
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
    const type = url.searchParams.get('type') // 'template' or 'draft'
    const id = parseInt(url.searchParams.get('id'))

    if (!type || !id) return json({ error: 'type and id required' }, 400)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(file))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    const key = `vault-assets/thumbnails/${type}-${id}.${ext}`
    const publicUrl = await uploadToR2(bucket, key, bytes, file.type)

    const table = type === 'template' ? 'cc_card_templates' : 'cc_card_drafts'
    await sql`UPDATE ${sql(table)} SET thumbnail_url = ${publicUrl}, updated_at = NOW() WHERE id = ${id}`

    return json({ success: true, thumbnail_url: publicUrl })
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/vault-dashboard-upload.js
git commit -m "feat(vault-dashboard): add upload endpoint for assets and thumbnails"
```

---

## Chunk 2: Frontend Foundation — Layout, Routing & Service Client

### Task 5: Frontend API Service

**Files:**
- Modify: `src/services/database.js` (add vaultDashboardService near end of file)

- [ ] **Step 1: Add the service object**

Add before the final exports at the bottom of `src/services/database.js`:

```javascript
// ─── Vault Dashboard (card creator) ───

export const vaultDashboardService = {
    // Templates
    async getTemplates(params = {}) { return apiCall('vault-dashboard', { action: 'templates', ...params }) },
    async getTemplate(id) { return apiCall('vault-dashboard', { action: 'template', id }) },
    async saveTemplate(data) { return apiPost('vault-dashboard', { action: 'save-template' }, data) },

    // Drafts
    async getDrafts(params = {}) { return apiCall('vault-dashboard', { action: 'drafts', ...params }) },
    async getDraft(id) { return apiCall('vault-dashboard', { action: 'draft', id }) },
    async saveDraft(data) { return apiPost('vault-dashboard', { action: 'save-draft' }, data) },

    // Review workflow
    async submitForReview(type, id) { return apiPost('vault-dashboard', { action: 'submit-for-review' }, { type, id }) },
    async approve(type, id) { return apiPost('vault-dashboard', { action: 'approve' }, { type, id }) },
    async reject(type, id, reason) { return apiPost('vault-dashboard', { action: 'reject' }, { type, id, reason }) },
    async archiveTemplate(id) { return apiPost('vault-dashboard', { action: 'archive-template' }, { id }) },

    // Assets
    async getAssets(params = {}) { return apiCall('vault-dashboard', { action: 'assets', ...params }) },
    async getAsset(id) { return apiCall('vault-dashboard', { action: 'asset', id }) },
    async deleteAsset(id) { return apiPost('vault-dashboard', { action: 'delete-asset' }, { id }) },

    // Uploads (multipart — use fetch directly)
    async uploadAsset(file, { name, category, tags }) {
        const form = new FormData()
        form.append('file', file)
        form.append('name', name || file.name)
        form.append('category', category || 'background')
        if (tags) form.append('tags', tags.join(','))
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/vault-dashboard-upload?action=upload-asset', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },

    async exportThumbnail(file, type, id) {
        const form = new FormData()
        form.append('file', file)
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`/api/vault-dashboard-upload?action=export-thumbnail&type=${type}&id=${id}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        })
        return res.json()
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(vault-dashboard): add frontend API service client"
```

---

### Task 6: Layout Components

**Files:**
- Create: `src/components/layout/VaultDashboardLayout.jsx`
- Create: `src/components/layout/VaultDashboardNavbar.jsx`

- [ ] **Step 1: Create VaultDashboardNavbar**

Follow the CodexNavbar pattern — fixed navbar with tabs:

```jsx
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSidebar } from '../../context/SidebarContext'
import UserMenu from '../UserMenu'
import PassionDisplay from '../PassionDisplay'
import smiteLogo from '../../assets/smite2.png'
import { Home, Menu } from 'lucide-react'

const tabs = [
    { path: '/vault-dashboard', label: 'Card Creator', exact: true },
    { path: '/vault-dashboard/templates', label: 'Templates' },
    { path: '/vault-dashboard/drafts', label: 'Drafts' },
    { path: '/vault-dashboard/assets', label: 'Assets' },
]

export default function VaultDashboardNavbar() {
    const { user } = useAuth()
    const { toggle: toggleSidebar } = useSidebar()
    const location = useLocation()

    const isActive = (tab) => {
        if (tab.exact) return location.pathname === tab.path
        return location.pathname.startsWith(tab.path)
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-700/50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center h-14 gap-4">
                    {/* Mobile menu */}
                    <button onClick={toggleSidebar} className="md:hidden text-gray-400 hover:text-white">
                        <Menu size={20} />
                    </button>

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 shrink-0">
                        <img src={smiteLogo} alt="SMITE" className="h-6" />
                    </Link>

                    <span className="text-amber-400 font-semibold text-sm tracking-wide">VAULT STUDIO</span>

                    {/* Desktop tabs */}
                    <div className="hidden md:flex items-center gap-1 ml-4">
                        {tabs.map(tab => (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                    isActive(tab)
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3 ml-auto">
                        <Link to="/" className="text-gray-400 hover:text-white"><Home size={18} /></Link>
                        <PassionDisplay compact />
                        <UserMenu />
                    </div>
                </div>
            </div>
        </nav>
    )
}
```

- [ ] **Step 2: Create VaultDashboardLayout**

```jsx
import { Outlet } from 'react-router-dom'
import VaultDashboardNavbar from './VaultDashboardNavbar'

export default function VaultDashboardLayout() {
    return (
        <>
            <VaultDashboardNavbar />
            <div className="pt-20">
                <Outlet />
            </div>
        </>
    )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/VaultDashboardLayout.jsx src/components/layout/VaultDashboardNavbar.jsx
git commit -m "feat(vault-dashboard): add layout and navbar components"
```

---

### Task 7: Route Registration & AdminNavbar Link

**Files:**
- Modify: `src/App.jsx` (add routes after codex block, ~line 183)
- Modify: `src/components/layout/AdminNavbar.jsx` (add to morePages, ~line 38)

- [ ] **Step 1: Add lazy imports to App.jsx**

After the Codex imports (~line 105):
```javascript
// Vault Dashboard (card creator)
const VaultDashboardLayout = lazy(() => import('./components/layout/VaultDashboardLayout'))
const CardCreator = lazy(() => import('./pages/vault-dashboard/CardCreator'))
const TemplatesPage = lazy(() => import('./pages/vault-dashboard/TemplatesPage'))
const DraftsPage = lazy(() => import('./pages/vault-dashboard/DraftsPage'))
const AssetsPage = lazy(() => import('./pages/vault-dashboard/AssetsPage'))
```

- [ ] **Step 2: Add routes after the codex block (~line 183)**

```jsx
{/* Vault Dashboard (card creator studio) */}
<Route path="vault-dashboard" element={
    <ProtectedRoute requiredPermission="vault_member" redirectTo="/">
        <Suspense fallback={null}><VaultDashboardLayout /></Suspense>
    </ProtectedRoute>
}>
    <Route index element={<Suspense fallback={null}><CardCreator /></Suspense>} />
    <Route path="templates" element={<Suspense fallback={null}><TemplatesPage /></Suspense>} />
    <Route path="drafts" element={<Suspense fallback={null}><DraftsPage /></Suspense>} />
    <Route path="assets" element={<Suspense fallback={null}><AssetsPage /></Suspense>} />
</Route>
```

- [ ] **Step 3: Add Vault Dashboard to AdminNavbar morePages**

In `AdminNavbar.jsx`, add before the `{ path: '/admin/settings'` entry (~line 38):
```javascript
{ path: '/vault-dashboard', label: 'Vault Studio', permission: 'vault_member' },
```

- [ ] **Step 4: Create placeholder page components**

Create minimal placeholder files so routes don't break:

`src/pages/vault-dashboard/CardCreator.jsx`:
```jsx
export default function CardCreator() {
    return <div className="max-w-7xl mx-auto px-4 py-6"><h1 className="text-2xl font-bold text-white">Card Creator</h1><p className="text-gray-400 mt-2">Coming soon...</p></div>
}
```

`src/pages/vault-dashboard/TemplatesPage.jsx`:
```jsx
export default function TemplatesPage() {
    return <div className="max-w-7xl mx-auto px-4 py-6"><h1 className="text-2xl font-bold text-white">Templates</h1><p className="text-gray-400 mt-2">Coming soon...</p></div>
}
```

`src/pages/vault-dashboard/DraftsPage.jsx`:
```jsx
export default function DraftsPage() {
    return <div className="max-w-7xl mx-auto px-4 py-6"><h1 className="text-2xl font-bold text-white">Drafts</h1><p className="text-gray-400 mt-2">Coming soon...</p></div>
}
```

`src/pages/vault-dashboard/AssetsPage.jsx`:
```jsx
export default function AssetsPage() {
    return <div className="max-w-7xl mx-auto px-4 py-6"><h1 className="text-2xl font-bold text-white">Assets</h1><p className="text-gray-400 mt-2">Coming soon...</p></div>
}
```

- [ ] **Step 5: Verify dev server loads and routes work**

```bash
npm start
# Navigate to /vault-dashboard — should see Card Creator placeholder
# Navigate to /vault-dashboard/templates, /drafts, /assets — should see placeholders
# Check AdminNavbar "More" dropdown — "Vault Studio" should appear for owner users
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/layout/AdminNavbar.jsx src/pages/vault-dashboard/
git commit -m "feat(vault-dashboard): add routes, placeholders, and admin navbar link"
```

---

## Chunk 3: Asset Library Page

### Task 8: Asset Library — Full Implementation

**Files:**
- Modify: `src/pages/vault-dashboard/AssetsPage.jsx`

- [ ] **Step 1: Implement AssetsPage with upload, browse, filter, delete**

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import { Upload, Search, Trash2, X, Image, Filter } from 'lucide-react'

const CATEGORIES = ['background', 'frame', 'overlay', 'texture', 'character', 'effect']

export default function AssetsPage() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    const [assets, setAssets] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterCategory, setFilterCategory] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [uploading, setUploading] = useState(false)
    const [showUpload, setShowUpload] = useState(false)
    const [selectedAsset, setSelectedAsset] = useState(null)
    const fileInputRef = useRef(null)

    // Upload form state
    const [uploadName, setUploadName] = useState('')
    const [uploadCategory, setUploadCategory] = useState('background')
    const [uploadTags, setUploadTags] = useState('')
    const [uploadFile, setUploadFile] = useState(null)
    const [uploadPreview, setUploadPreview] = useState(null)

    const fetchAssets = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterCategory) params.category = filterCategory
            if (searchQuery) params.search = searchQuery
            const res = await vaultDashboardService.getAssets(params)
            setAssets(res.assets || [])
        } catch (e) {
            console.error('Failed to load assets:', e)
        } finally {
            setLoading(false)
        }
    }, [filterCategory, searchQuery])

    useEffect(() => { fetchAssets() }, [fetchAssets])

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadFile(file)
        setUploadName(file.name.replace(/\.[^.]+$/, ''))
        const reader = new FileReader()
        reader.onload = (ev) => setUploadPreview(ev.target.result)
        reader.readAsDataURL(file)
    }

    const handleUpload = async () => {
        if (!uploadFile) return
        setUploading(true)
        try {
            const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean)
            const res = await vaultDashboardService.uploadAsset(uploadFile, {
                name: uploadName || uploadFile.name,
                category: uploadCategory,
                tags,
            })
            if (res.success) {
                setShowUpload(false)
                setUploadFile(null)
                setUploadPreview(null)
                setUploadName('')
                setUploadTags('')
                fetchAssets()
            }
        } catch (e) {
            console.error('Upload failed:', e)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this asset? This cannot be undone.')) return
        try {
            await vaultDashboardService.deleteAsset(id)
            setSelectedAsset(null)
            fetchAssets()
        } catch (e) {
            console.error('Delete failed:', e)
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Asset Library</h1>
                <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Upload size={16} /> Upload Asset
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
            </div>

            {/* Asset Grid */}
            {loading ? (
                <div className="text-center text-gray-500 py-12">Loading assets...</div>
            ) : assets.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                    <Image size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No assets yet. Upload some images to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {assets.map(asset => (
                        <button
                            key={asset.id}
                            onClick={() => setSelectedAsset(asset)}
                            className="group relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-colors aspect-square"
                        >
                            <img
                                src={asset.thumbnail_url || asset.url}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="text-xs text-white truncate">{asset.name}</p>
                                <span className="text-[10px] text-gray-400 capitalize">{asset.category}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowUpload(false)}>
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Upload Asset</h2>
                            <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                        </div>

                        {/* Drop zone / file input */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors mb-4"
                        >
                            {uploadPreview ? (
                                <img src={uploadPreview} alt="Preview" className="mx-auto max-h-32 rounded" />
                            ) : (
                                <>
                                    <Upload size={32} className="mx-auto mb-2 text-gray-500" />
                                    <p className="text-sm text-gray-400">Click or drag to upload (PNG, JPG, WebP — max 2MB)</p>
                                </>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

                        <div className="space-y-3">
                            <input
                                type="text" placeholder="Asset name"
                                value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                            />
                            <select
                                value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                            </select>
                            <input
                                type="text" placeholder="Tags (comma-separated)"
                                value={uploadTags} onChange={(e) => setUploadTags(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!uploadFile || uploading}
                            className="w-full mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </div>
            )}

            {/* Asset Detail Modal */}
            {selectedAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedAsset(null)}>
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">{selectedAsset.name}</h2>
                            <button onClick={() => setSelectedAsset(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <img src={selectedAsset.url} alt={selectedAsset.name} className="w-full rounded-lg mb-4 max-h-64 object-contain bg-gray-800" />
                        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                            <div><span className="text-gray-500">Category:</span> <span className="text-white capitalize">{selectedAsset.category}</span></div>
                            <div><span className="text-gray-500">Format:</span> <span className="text-white">{selectedAsset.metadata?.format || 'unknown'}</span></div>
                            <div><span className="text-gray-500">Size:</span> <span className="text-white">{selectedAsset.metadata?.size ? Math.round(selectedAsset.metadata.size / 1024) + ' KB' : 'unknown'}</span></div>
                            {selectedAsset.tags?.length > 0 && (
                                <div className="col-span-2">
                                    <span className="text-gray-500">Tags:</span>{' '}
                                    {selectedAsset.tags.map(t => <span key={t} className="inline-block bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs mr-1">{t}</span>)}
                                </div>
                            )}
                        </div>
                        {canApprove && (
                            <button
                                onClick={() => handleDelete(selectedAsset.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                            >
                                <Trash2 size={14} /> Delete Asset
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Verify asset upload and browse works**

```bash
npm start
# Navigate to /vault-dashboard/assets
# Upload an image — should appear in grid
# Click asset — detail modal opens
# Filter by category — grid updates
# Search — results filter
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault-dashboard/AssetsPage.jsx
git commit -m "feat(vault-dashboard): implement asset library with upload, browse, filter, delete"
```

---

## Chunk 4: Card Creator — Template Mode

### Task 9: Card Creator Main Layout

**Files:**
- Modify: `src/pages/vault-dashboard/CardCreator.jsx`

- [ ] **Step 1: Implement the two-panel editor layout with top bar and status bar**

```jsx
import { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import TemplateModeControls from './editor/TemplateModeControls'
import FullArtModeControls from './editor/FullArtModeControls'
import CardPreview from './preview/CardPreview'
import { Save, Download, Send, Check, X as XIcon } from 'lucide-react'

const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'full_art']

const DEFAULT_TEMPLATE_DATA = {
    mode: 'template',
    baseCard: { type: 'player', frameStyle: 'default', rarity: 'common', holoType: null, customName: null, customStats: null, customImage: null, flavorText: null },
    layers: [],
}

export default function CardCreator() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')

    // Editor state
    const [mode, setMode] = useState('template') // 'template' | 'full_art'
    const [cardType, setCardType] = useState('player')
    const [rarity, setRarity] = useState('common')
    const [templateData, setTemplateData] = useState(DEFAULT_TEMPLATE_DATA)
    const [name, setName] = useState('')

    // Save state
    const [saveTarget, setSaveTarget] = useState(null) // { type: 'template'|'draft', id }
    const [status, setStatus] = useState('draft')
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [error, setError] = useState(null)

    const updateTemplateData = useCallback((updates) => {
        setTemplateData(prev => ({ ...prev, ...updates }))
        setDirty(true)
    }, [])

    const updateBaseCard = useCallback((updates) => {
        setTemplateData(prev => ({
            ...prev,
            baseCard: { ...prev.baseCard, ...updates },
        }))
        setDirty(true)
    }, [])

    const handleModeToggle = (newMode) => {
        setMode(newMode)
        updateTemplateData({ mode: newMode })
        if (newMode === 'full_art') setRarity('full_art')
    }

    const handleRarityChange = (newRarity) => {
        setRarity(newRarity)
        updateBaseCard({ rarity: newRarity })
        if (newRarity === 'full_art' && mode !== 'full_art') handleModeToggle('full_art')
        if (newRarity !== 'full_art' && mode === 'full_art') handleModeToggle('template')
    }

    const handleSave = async (targetType) => {
        setSaving(true)
        setError(null)
        try {
            const payload = {
                id: saveTarget?.type === targetType ? saveTarget.id : undefined,
                card_type: cardType,
                rarity,
                template_data: { ...templateData, mode, baseCard: { ...templateData.baseCard, type: cardType, rarity } },
            }
            if (targetType === 'template') {
                payload.name = name || 'Untitled Template'
                const res = await vaultDashboardService.saveTemplate(payload)
                setSaveTarget({ type: 'template', id: res.template.id })
                setStatus(res.template.status)
            } else {
                const res = await vaultDashboardService.saveDraft(payload)
                setSaveTarget({ type: 'draft', id: res.draft.id })
                setStatus(res.draft.status)
            }
            setDirty(false)
        } catch (e) {
            setError(e.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const handleSubmitForReview = async () => {
        if (!saveTarget) return
        try {
            await vaultDashboardService.submitForReview(saveTarget.type, saveTarget.id)
            setStatus('pending_review')
        } catch (e) {
            setError(e.message || 'Submit failed')
        }
    }

    const handleApprove = async () => {
        if (!saveTarget) return
        await vaultDashboardService.approve(saveTarget.type, saveTarget.id)
        setStatus('approved')
    }

    const handleReject = async () => {
        if (!saveTarget) return
        const reason = prompt('Rejection reason (optional):')
        await vaultDashboardService.reject(saveTarget.type, saveTarget.id, reason)
        setStatus('rejected')
    }

    const statusColors = {
        draft: 'bg-gray-600', pending_review: 'bg-yellow-600', approved: 'bg-green-600', rejected: 'bg-red-600', archived: 'bg-gray-500',
    }

    return (
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex flex-col h-[calc(100vh-56px)]">
            {/* Top Bar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* Name (templates only) */}
                <input
                    type="text"
                    placeholder="Card name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-48 focus:outline-none focus:border-amber-500"
                />

                {/* Mode toggle */}
                <div className="flex bg-gray-800 rounded-lg p-0.5">
                    <button
                        onClick={() => handleModeToggle('template')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${mode === 'template' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Template
                    </button>
                    <button
                        onClick={() => handleModeToggle('full_art')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${mode === 'full_art' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Full Art
                    </button>
                </div>

                {/* Card type */}
                <select
                    value={cardType}
                    onChange={(e) => { setCardType(e.target.value); updateBaseCard({ type: e.target.value }) }}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    {CARD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>

                {/* Rarity */}
                <select
                    value={rarity}
                    onChange={(e) => handleRarityChange(e.target.value)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    {RARITIES.map(r => <option key={r} value={r}>{r === 'full_art' ? 'Full Art' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => handleSave('draft')} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                        <Save size={14} /> Save Draft
                    </button>
                    <button onClick={() => handleSave('template')} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors">
                        <Save size={14} /> Save Template
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                        <Download size={14} /> Export PNG
                    </button>
                </div>
            </div>

            {/* Main Editor: Controls + Preview */}
            <div className="flex gap-4 flex-1 min-h-0">
                {/* Left panel — controls */}
                <div className="w-[400px] shrink-0 overflow-y-auto pr-2">
                    {mode === 'template' ? (
                        <TemplateModeControls
                            cardType={cardType}
                            rarity={rarity}
                            baseCard={templateData.baseCard}
                            onUpdate={updateBaseCard}
                        />
                    ) : (
                        <FullArtModeControls
                            layers={templateData.layers || []}
                            onLayersChange={(layers) => updateTemplateData({ layers })}
                        />
                    )}
                </div>

                {/* Right panel — preview */}
                <div className="flex-1 flex items-start justify-center overflow-y-auto">
                    <CardPreview
                        mode={mode}
                        templateData={{ ...templateData, baseCard: { ...templateData.baseCard, type: cardType, rarity } }}
                    />
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-800 text-sm">
                {dirty && <span className="text-yellow-400 text-xs">Unsaved changes</span>}
                {!dirty && saveTarget && <span className="text-green-400 text-xs">Saved</span>}
                {error && <span className="text-red-400 text-xs">{error}</span>}

                <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColors[status] || 'bg-gray-600'}`}>
                    {status.replace('_', ' ')}
                </span>

                <div className="ml-auto flex items-center gap-2">
                    {saveTarget && status === 'draft' && (
                        <button onClick={handleSubmitForReview} className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors">
                            <Send size={12} /> Submit for Review
                        </button>
                    )}
                    {canApprove && status === 'pending_review' && (
                        <>
                            <button onClick={handleApprove} className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors">
                                <Check size={12} /> Approve
                            </button>
                            <button onClick={handleReject} className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors">
                                <XIcon size={12} /> Reject
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault-dashboard/CardCreator.jsx
git commit -m "feat(vault-dashboard): implement card creator main layout with save/review workflow"
```

---

### Task 10: Template Mode Controls

**Files:**
- Create: `src/pages/vault-dashboard/editor/TemplateModeControls.jsx`

- [ ] **Step 1: Implement template mode left panel**

```jsx
import { useState, useEffect } from 'react'
import { RARITIES } from '../../../data/vault/economy'

const HOLO_TYPES = ['common', 'holo', 'reverse', 'full', 'amazing', 'ultra', 'shiny', 'vstar',
    'galaxy', 'sparkle', 'rainbow-alt', 'cosmos', 'radiant', 'rainbow', 'secret', 'gold']

export default function TemplateModeControls({ cardType, rarity, baseCard, onUpdate }) {
    const rarityConfig = RARITIES[rarity]
    const availableHolos = rarityConfig?.holoEffects || []

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Template Settings</h3>

            {/* Holo Effect */}
            {rarity !== 'common' && (
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Holo Effect</label>
                    <select
                        value={baseCard.holoType || ''}
                        onChange={(e) => onUpdate({ holoType: e.target.value || null })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                        <option value="">None</option>
                        {availableHolos.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            )}

            {/* Frame Style */}
            <div>
                <label className="block text-xs text-gray-400 mb-1">Frame Style</label>
                <select
                    value={baseCard.frameStyle || 'default'}
                    onChange={(e) => onUpdate({ frameStyle: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                    <option value="default">Default</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                </select>
            </div>

            {/* Custom Fields (for 'custom' card type) */}
            {cardType === 'custom' && (
                <>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Custom Name</label>
                        <input
                            type="text"
                            value={baseCard.customName || ''}
                            onChange={(e) => onUpdate({ customName: e.target.value })}
                            placeholder="Card name"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Flavor Text</label>
                        <textarea
                            value={baseCard.flavorText || ''}
                            onChange={(e) => onUpdate({ flavorText: e.target.value })}
                            placeholder="Card flavor text..."
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Custom Image URL</label>
                        <input
                            type="text"
                            value={baseCard.customImage || ''}
                            onChange={(e) => onUpdate({ customImage: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </>
            )}

            {/* Player/God selector placeholder */}
            {(cardType === 'player' || cardType === 'god' || cardType === 'item') && (
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <p className="text-xs text-gray-500">Definition selector for {cardType} cards will search existing database entries.</p>
                    <p className="text-xs text-gray-500 mt-1">This connects to the existing cc_player_defs / god / item catalogs.</p>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault-dashboard/editor/TemplateModeControls.jsx
git commit -m "feat(vault-dashboard): add template mode controls panel"
```

---

### Task 11: Card Preview Component

**Files:**
- Create: `src/pages/vault-dashboard/preview/CardPreview.jsx`
- Create: `src/pages/vault-dashboard/preview/TemplateRenderer.jsx`
- Create: `src/pages/vault-dashboard/preview/FullArtRenderer.jsx`

- [ ] **Step 1: Create CardPreview wrapper**

```jsx
import { useState } from 'react'
import TemplateRenderer from './TemplateRenderer'
import FullArtRenderer from './FullArtRenderer'
import { ZoomIn, ZoomOut, Grid3x3 } from 'lucide-react'

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5]

export default function CardPreview({ mode, templateData }) {
    const [zoom, setZoom] = useState(1)
    const [showOutlines, setShowOutlines] = useState(false)

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
                {ZOOM_LEVELS.map(z => (
                    <button
                        key={z}
                        onClick={() => setZoom(z)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            zoom === z ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                    >
                        {Math.round(z * 100)}%
                    </button>
                ))}
                {mode === 'full_art' && (
                    <button
                        onClick={() => setShowOutlines(!showOutlines)}
                        className={`p-1.5 rounded transition-colors ${showOutlines ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                        title="Show layer outlines"
                    >
                        <Grid3x3 size={14} />
                    </button>
                )}
            </div>

            {/* Card render */}
            <div
                className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 flex items-center justify-center"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
                {mode === 'template' ? (
                    <TemplateRenderer templateData={templateData} />
                ) : (
                    <FullArtRenderer layers={templateData.layers || []} showOutlines={showOutlines} />
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Create TemplateRenderer**

```jsx
import TradingCard from '../../../components/TradingCard'

export default function TemplateRenderer({ templateData }) {
    const { baseCard } = templateData

    // For template mode, render using the existing TradingCard component
    // with custom overrides from baseCard config
    if (baseCard.type === 'player') {
        return (
            <TradingCard
                playerName={baseCard.customName || 'Player Name'}
                teamName="Team"
                teamColor="#6366f1"
                seasonName="Season"
                role="mid"
                rarity={baseCard.rarity}
                holo={baseCard.holoType ? { rarity: baseCard.rarity, holoType: 'full' } : undefined}
                size={300}
                stats={{ kills: 10, deaths: 3, assists: 8, damage: 25000, mitigated: 15000, wins: 7, losses: 3 }}
            />
        )
    }

    // Non-player card types — placeholder for now
    return (
        <div className="w-[250px] h-[350px] rounded-xl border-2 border-gray-600 bg-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-400">
                <p className="text-sm font-medium capitalize">{baseCard.type} Card</p>
                <p className="text-xs mt-1">{baseCard.rarity}</p>
                {baseCard.customName && <p className="text-xs text-amber-400 mt-2">{baseCard.customName}</p>}
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Create FullArtRenderer**

```jsx
export default function FullArtRenderer({ layers = [], showOutlines = false }) {
    const sortedLayers = [...layers].sort((a, b) => (a.z || 0) - (b.z || 0))
    const visibleLayers = sortedLayers.filter(l => l.visible !== false)

    return (
        <div className="relative" style={{ width: 300, height: 420 }}>
            {/* Card background */}
            <div className="absolute inset-0 rounded-xl bg-gray-900 border border-gray-700 overflow-hidden">
                {visibleLayers.map(layer => (
                    <div
                        key={layer.id}
                        className={showOutlines ? 'outline outline-1 outline-cyan-500/40' : ''}
                        style={{
                            position: 'absolute',
                            left: layer.position?.x || 0,
                            top: layer.position?.y || 0,
                            width: layer.size?.w || '100%',
                            height: layer.size?.h || '100%',
                            opacity: layer.opacity ?? 1,
                            mixBlendMode: layer.blendMode || 'normal',
                            zIndex: layer.z || 0,
                        }}
                    >
                        {layer.type === 'image' && layer.url && (
                            <img src={layer.url} alt={layer.id} className="w-full h-full object-cover" />
                        )}
                        {layer.type === 'effect' && (
                            <div
                                className={`w-full h-full holo-effect-${layer.effectName || 'rainbow'}`}
                                style={{ opacity: layer.opacity ?? 0.6 }}
                            />
                        )}
                        {layer.type === 'frame' && (
                            <div className="w-full h-full border-4 border-amber-400/30 rounded-xl pointer-events-none" />
                        )}
                        {layer.type === 'text' && (
                            <span style={{
                                fontFamily: layer.font || 'Cinzel, serif',
                                fontSize: layer.fontSize || 24,
                                color: layer.color || '#ffffff',
                                textShadow: layer.shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                WebkitTextStroke: layer.stroke ? `${layer.stroke.width || 1}px ${layer.stroke.color || '#000'}` : undefined,
                            }}>
                                {layer.content || 'Text'}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {visibleLayers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                    Add layers to build your card
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault-dashboard/preview/
git commit -m "feat(vault-dashboard): add card preview with template and full-art renderers"
```

---

## Chunk 5: Card Creator — Full Art Mode

### Task 12: Full Art Mode Controls (Layer Stack + Properties)

**Files:**
- Create: `src/pages/vault-dashboard/editor/FullArtModeControls.jsx`
- Create: `src/pages/vault-dashboard/editor/LayerStackPanel.jsx`
- Create: `src/pages/vault-dashboard/editor/LayerProperties.jsx`

- [ ] **Step 1: Create FullArtModeControls (orchestrator)**

```jsx
import { useState } from 'react'
import LayerStackPanel from './LayerStackPanel'
import LayerProperties from './LayerProperties'

let nextLayerId = 1

export default function FullArtModeControls({ layers, onLayersChange }) {
    const [selectedLayerId, setSelectedLayerId] = useState(null)
    const selectedLayer = layers.find(l => l.id === selectedLayerId)

    const addLayer = (type) => {
        const id = `${type}-${nextLayerId++}`
        const z = layers.length
        let newLayer = { id, type, z, visible: true, opacity: 1, blendMode: 'normal' }

        switch (type) {
            case 'image':
                newLayer = { ...newLayer, url: '', assetId: null, position: { x: 0, y: 0 }, size: { w: '100%', h: '100%' } }
                break
            case 'effect':
                newLayer = { ...newLayer, effectName: 'rainbow', opacity: 0.6, blendMode: 'overlay' }
                break
            case 'frame':
                newLayer = { ...newLayer, frameStyle: 'full_art_gold' }
                break
            case 'text':
                newLayer = { ...newLayer, content: 'Text', font: 'Cinzel', fontSize: 24, color: '#ffffff', position: { x: 50, y: 15 }, shadow: true, stroke: null }
                break
        }

        onLayersChange([...layers, newLayer])
        setSelectedLayerId(id)
    }

    const updateLayer = (id, updates) => {
        onLayersChange(layers.map(l => l.id === id ? { ...l, ...updates } : l))
    }

    const deleteLayer = (id) => {
        onLayersChange(layers.filter(l => l.id !== id))
        if (selectedLayerId === id) setSelectedLayerId(null)
    }

    const reorderLayers = (reorderedLayers) => {
        // Reassign z-indexes based on new order
        const updated = reorderedLayers.map((l, i) => ({ ...l, z: i }))
        onLayersChange(updated)
    }

    const toggleVisibility = (id) => {
        updateLayer(id, { visible: !layers.find(l => l.id === id)?.visible })
    }

    return (
        <div className="space-y-4">
            <LayerStackPanel
                layers={layers}
                selectedLayerId={selectedLayerId}
                onSelect={setSelectedLayerId}
                onAdd={addLayer}
                onDelete={deleteLayer}
                onReorder={reorderLayers}
                onToggleVisibility={toggleVisibility}
            />

            {selectedLayer && (
                <LayerProperties
                    layer={selectedLayer}
                    onUpdate={(updates) => updateLayer(selectedLayer.id, updates)}
                />
            )}
        </div>
    )
}
```

- [ ] **Step 2: Create LayerStackPanel**

```jsx
import { Eye, EyeOff, Trash2, Plus, Image, Sparkles, Frame, Type, GripVertical } from 'lucide-react'
import { useState } from 'react'

const LAYER_TYPES = [
    { type: 'image', icon: Image, label: 'Image' },
    { type: 'effect', icon: Sparkles, label: 'Effect' },
    { type: 'frame', icon: Frame, label: 'Frame' },
    { type: 'text', icon: Type, label: 'Text' },
]

const TYPE_COLORS = {
    image: 'bg-blue-500/20 text-blue-400',
    effect: 'bg-purple-500/20 text-purple-400',
    frame: 'bg-amber-500/20 text-amber-400',
    text: 'bg-green-500/20 text-green-400',
}

export default function LayerStackPanel({ layers, selectedLayerId, onSelect, onAdd, onDelete, onReorder, onToggleVisibility }) {
    const [showAddMenu, setShowAddMenu] = useState(false)
    const sortedLayers = [...layers].sort((a, b) => (b.z || 0) - (a.z || 0)) // top layer first

    const moveLayer = (id, direction) => {
        const idx = sortedLayers.findIndex(l => l.id === id)
        if (direction === 'up' && idx > 0) {
            const newOrder = [...sortedLayers];
            [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]]
            onReorder(newOrder.reverse()) // reverse back to z-order ascending
        } else if (direction === 'down' && idx < sortedLayers.length - 1) {
            const newOrder = [...sortedLayers];
            [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
            onReorder(newOrder.reverse())
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Layers</h3>
                <div className="relative">
                    <button
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                    >
                        <Plus size={12} /> Add Layer
                    </button>
                    {showAddMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 w-32">
                            {LAYER_TYPES.map(({ type, icon: Icon, label }) => (
                                <button
                                    key={type}
                                    onClick={() => { onAdd(type); setShowAddMenu(false) }}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                >
                                    <Icon size={14} /> {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Layer list */}
            <div className="space-y-1">
                {sortedLayers.map(layer => (
                    <div
                        key={layer.id}
                        onClick={() => onSelect(layer.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            selectedLayerId === layer.id ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-gray-800/50 border border-transparent hover:bg-gray-800'
                        }`}
                    >
                        <GripVertical size={12} className="text-gray-600 shrink-0 cursor-grab" />

                        {/* Type badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[layer.type]}`}>
                            {layer.type}
                        </span>

                        {/* Name */}
                        <span className="text-sm text-gray-300 truncate flex-1">{layer.id}</span>

                        {/* Move buttons */}
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up') }} className="text-gray-500 hover:text-white text-xs">&#9650;</button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down') }} className="text-gray-500 hover:text-white text-xs">&#9660;</button>

                        {/* Visibility */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id) }}
                            className="text-gray-500 hover:text-white"
                        >
                            {layer.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        {/* Delete */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(layer.id) }}
                            className="text-gray-500 hover:text-red-400"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {layers.length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-4">No layers yet. Click "Add Layer" to start.</p>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Create LayerProperties**

```jsx
const BLEND_MODES = ['normal', 'overlay', 'multiply', 'screen', 'soft-light']
const EFFECT_TYPES = ['rainbow', 'sparkle', 'foil', 'cosmos', 'galaxy', 'radiant', 'secret', 'gold']
const FONTS = ['Cinzel', 'Bebas Neue', 'Inter', 'Georgia', 'monospace']

export default function LayerProperties({ layer, onUpdate }) {
    return (
        <div className="space-y-3 border-t border-gray-800 pt-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">Properties — {layer.type}</h4>

            {/* Common: opacity + blend mode */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Opacity</label>
                    <input type="range" min="0" max="1" step="0.05" value={layer.opacity ?? 1}
                        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500" />
                    <span className="text-[10px] text-gray-500">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                </div>
                <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Blend</label>
                    <select value={layer.blendMode || 'normal'} onChange={(e) => onUpdate({ blendMode: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none">
                        {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            {/* Image layer */}
            {layer.type === 'image' && (
                <>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Image URL (or use Asset Picker)</label>
                        <input type="text" value={layer.url || ''} onChange={(e) => onUpdate({ url: e.target.value })}
                            placeholder="Paste URL or pick from assets..."
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">X</label>
                            <input type="number" value={layer.position?.x || 0} onChange={(e) => onUpdate({ position: { ...layer.position, x: parseInt(e.target.value) || 0 } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Y</label>
                            <input type="number" value={layer.position?.y || 0} onChange={(e) => onUpdate({ position: { ...layer.position, y: parseInt(e.target.value) || 0 } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Width</label>
                            <input type="text" value={layer.size?.w || '100%'} onChange={(e) => onUpdate({ size: { ...layer.size, w: e.target.value } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Height</label>
                            <input type="text" value={layer.size?.h || '100%'} onChange={(e) => onUpdate({ size: { ...layer.size, h: e.target.value } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                    </div>
                </>
            )}

            {/* Effect layer */}
            {layer.type === 'effect' && (
                <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Effect Type</label>
                    <select value={layer.effectName || 'rainbow'} onChange={(e) => onUpdate({ effectName: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none">
                        {EFFECT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
            )}

            {/* Frame layer */}
            {layer.type === 'frame' && (
                <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Frame Style</label>
                    <select value={layer.frameStyle || 'full_art_gold'} onChange={(e) => onUpdate({ frameStyle: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none">
                        <option value="full_art_gold">Gold</option>
                        <option value="full_art_silver">Silver</option>
                        <option value="full_art_cosmic">Cosmic</option>
                    </select>
                </div>
            )}

            {/* Text layer */}
            {layer.type === 'text' && (
                <>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Content</label>
                        <input type="text" value={layer.content || ''} onChange={(e) => onUpdate({ content: e.target.value })}
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Font</label>
                            <select value={layer.font || 'Cinzel'} onChange={(e) => onUpdate({ font: e.target.value })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none">
                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Size</label>
                            <input type="range" min="8" max="72" value={layer.fontSize || 24}
                                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
                                className="w-full accent-amber-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Color</label>
                            <input type="color" value={layer.color || '#ffffff'} onChange={(e) => onUpdate({ color: e.target.value })}
                                className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                        </div>
                        <div className="flex items-end gap-2">
                            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                                <input type="checkbox" checked={!!layer.shadow} onChange={(e) => onUpdate({ shadow: e.target.checked })} className="accent-amber-500" />
                                Shadow
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">X</label>
                            <input type="number" value={layer.position?.x || 0} onChange={(e) => onUpdate({ position: { ...layer.position, x: parseInt(e.target.value) || 0 } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Y</label>
                            <input type="number" value={layer.position?.y || 0} onChange={(e) => onUpdate({ position: { ...layer.position, y: parseInt(e.target.value) || 0 } })}
                                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none" />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault-dashboard/editor/
git commit -m "feat(vault-dashboard): add full art mode controls with layer stack and properties panels"
```

---

## Chunk 6: Templates & Drafts Management Pages

### Task 13: Templates Page

**Files:**
- Modify: `src/pages/vault-dashboard/TemplatesPage.jsx`

- [ ] **Step 1: Implement templates browser with filters and status badges**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import { Search, Filter, FileText } from 'lucide-react'
import { RARITIES } from '../../data/vault/economy'

const STATUS_COLORS = {
    draft: 'bg-gray-600 text-gray-200',
    pending_review: 'bg-yellow-600 text-yellow-100',
    approved: 'bg-green-600 text-green-100',
    rejected: 'bg-red-600 text-red-100',
    archived: 'bg-gray-500 text-gray-300',
}

const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom']

export default function TemplatesPage() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')
    const navigate = useNavigate()

    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterRarity, setFilterRarity] = useState('')
    const [filterType, setFilterType] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchTemplates = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterStatus) params.status = filterStatus
            if (filterRarity) params.rarity = filterRarity
            if (filterType) params.card_type = filterType
            const res = await vaultDashboardService.getTemplates(params)
            setTemplates(res.templates || [])
        } catch (e) {
            console.error('Failed to load templates:', e)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterRarity, filterType])

    useEffect(() => { fetchTemplates() }, [fetchTemplates])

    const filtered = searchQuery
        ? templates.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : templates

    const handleApprove = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.approve('template', id)
        fetchTemplates()
    }

    const handleReject = async (e, id) => {
        e.stopPropagation()
        const reason = prompt('Rejection reason (optional):')
        await vaultDashboardService.reject('template', id, reason)
        fetchTemplates()
    }

    const handleArchive = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.archiveTemplate(id)
        fetchTemplates()
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-white mb-6">Templates</h1>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Search templates..." value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                </select>
                <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="">All Rarities</option>
                    {Object.keys(RARITIES).map(r => <option key={r} value={r}>{r === 'full_art' ? 'Full Art' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="">All Types</option>
                    {CARD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
            </div>

            {/* Template list */}
            {loading ? (
                <div className="text-center text-gray-500 py-12">Loading templates...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                    <FileText size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No templates found.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(t => (
                        <div
                            key={t.id}
                            onClick={() => navigate('/vault-dashboard', { state: { loadTemplate: t.id } })}
                            className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-amber-500/30 cursor-pointer transition-colors"
                        >
                            {/* Thumbnail */}
                            {t.thumbnail_url ? (
                                <img src={t.thumbnail_url} alt="" className="w-16 h-20 object-cover rounded bg-gray-900" />
                            ) : (
                                <div className="w-16 h-20 bg-gray-900 rounded flex items-center justify-center">
                                    <FileText size={20} className="text-gray-700" />
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{t.name || 'Untitled'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400 capitalize">{t.card_type}</span>
                                    <span className="text-gray-600">·</span>
                                    <span className="text-xs capitalize" style={{ color: RARITIES[t.rarity]?.color || '#9ca3af' }}>{t.rarity === 'full_art' ? 'Full Art' : t.rarity}</span>
                                    {t.creator_name && <>
                                        <span className="text-gray-600">·</span>
                                        <span className="text-xs text-gray-500">by {t.creator_name}</span>
                                    </>}
                                </div>
                            </div>

                            {/* Status badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                                {t.status.replace('_', ' ')}
                            </span>

                            {/* Owner actions */}
                            {canApprove && t.status === 'pending_review' && (
                                <div className="flex gap-1">
                                    <button onClick={(e) => handleApprove(e, t.id)} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs">Approve</button>
                                    <button onClick={(e) => handleReject(e, t.id)} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs">Reject</button>
                                </div>
                            )}
                            {canApprove && t.status === 'approved' && (
                                <button onClick={(e) => handleArchive(e, t.id)} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs">Archive</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault-dashboard/TemplatesPage.jsx
git commit -m "feat(vault-dashboard): implement templates browser with filters and approval actions"
```

---

### Task 14: Drafts Page

**Files:**
- Modify: `src/pages/vault-dashboard/DraftsPage.jsx`

- [ ] **Step 1: Implement drafts page (same pattern as templates, with notes column)**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { vaultDashboardService } from '../../services/database'
import { Search, FileText } from 'lucide-react'
import { RARITIES } from '../../data/vault/economy'

const STATUS_COLORS = {
    draft: 'bg-gray-600 text-gray-200',
    pending_review: 'bg-yellow-600 text-yellow-100',
    approved: 'bg-green-600 text-green-100',
    rejected: 'bg-red-600 text-red-100',
}

export default function DraftsPage() {
    const { hasPermission } = useAuth()
    const canApprove = hasPermission('vault_approve')
    const navigate = useNavigate()

    const [drafts, setDrafts] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterRarity, setFilterRarity] = useState('')

    const fetchDrafts = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterStatus) params.status = filterStatus
            if (filterRarity) params.rarity = filterRarity
            const res = await vaultDashboardService.getDrafts(params)
            setDrafts(res.drafts || [])
        } catch (e) {
            console.error('Failed to load drafts:', e)
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterRarity])

    useEffect(() => { fetchDrafts() }, [fetchDrafts])

    const handleApprove = async (e, id) => {
        e.stopPropagation()
        await vaultDashboardService.approve('draft', id)
        fetchDrafts()
    }

    const handleReject = async (e, id) => {
        e.stopPropagation()
        const reason = prompt('Rejection reason (optional):')
        await vaultDashboardService.reject('draft', id, reason)
        fetchDrafts()
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-white mb-6">Drafts</h1>

            <div className="flex items-center gap-3 mb-6">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
                    <option value="">All Rarities</option>
                    {Object.keys(RARITIES).map(r => <option key={r} value={r}>{r === 'full_art' ? 'Full Art' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 py-12">Loading drafts...</div>
            ) : drafts.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                    <FileText size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No drafts found.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {drafts.map(d => (
                        <div
                            key={d.id}
                            onClick={() => navigate('/vault-dashboard', { state: { loadDraft: d.id } })}
                            className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-amber-500/30 cursor-pointer transition-colors"
                        >
                            {d.thumbnail_url ? (
                                <img src={d.thumbnail_url} alt="" className="w-16 h-20 object-cover rounded bg-gray-900" />
                            ) : (
                                <div className="w-16 h-20 bg-gray-900 rounded flex items-center justify-center">
                                    <FileText size={20} className="text-gray-700" />
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium capitalize">{d.card_type} Card Draft #{d.id}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs capitalize" style={{ color: RARITIES[d.rarity]?.color || '#9ca3af' }}>{d.rarity === 'full_art' ? 'Full Art' : d.rarity}</span>
                                    {d.creator_name && <>
                                        <span className="text-gray-600">·</span>
                                        <span className="text-xs text-gray-500">by {d.creator_name}</span>
                                    </>}
                                </div>
                                {d.notes && <p className="text-xs text-gray-500 mt-1 truncate">{d.notes}</p>}
                                {d.rejection_reason && <p className="text-xs text-red-400 mt-1 truncate">Rejected: {d.rejection_reason}</p>}
                            </div>

                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                                {d.status.replace('_', ' ')}
                            </span>

                            {canApprove && d.status === 'pending_review' && (
                                <div className="flex gap-1">
                                    <button onClick={(e) => handleApprove(e, d.id)} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs">Approve</button>
                                    <button onClick={(e) => handleReject(e, d.id)} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs">Reject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault-dashboard/DraftsPage.jsx
git commit -m "feat(vault-dashboard): implement drafts browser with review workflow"
```

---

## Chunk 7: PNG Export & Final Integration

### Task 15: PNG Export

**Files:**
- Create: `src/pages/vault-dashboard/preview/ExportCanvas.js`

- [ ] **Step 1: Implement canvas-based PNG export utility**

```javascript
// Canvas-based PNG export for card previews
// Walks the layer stack and composites onto an offscreen canvas

export async function exportCardToPNG(previewElement, { width = 300, height = 420 } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = width * 2 // 2x for retina
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)

    // Draw background
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 12)
    ctx.fill()

    // Use html2canvas-like approach: capture the DOM element
    // For v1, we'll use the simpler approach of converting the preview DOM to canvas
    // via the built-in drawImage with SVG foreignObject
    try {
        const svgData = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    ${new XMLSerializer().serializeToString(previewElement)}
                </foreignObject>
            </svg>
        `
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
        })

        ctx.drawImage(img, 0, 0, width, height)
    } catch {
        // Fallback: just export what we can
        ctx.fillStyle = '#ffffff'
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Export preview', width / 2, height / 2)
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
}

export function downloadBlob(blob, filename = 'card.png') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Wire export button in CardCreator**

In `CardCreator.jsx`, add an import and ref for the preview:
```javascript
import { exportCardToPNG, downloadBlob } from './preview/ExportCanvas'
```

Update the Export PNG button's onClick to call:
```javascript
const handleExport = async () => {
    const previewEl = document.querySelector('[data-card-preview]')
    if (!previewEl) return
    const blob = await exportCardToPNG(previewEl)
    if (blob) {
        downloadBlob(blob, `${name || 'card'}.png`)
        // Upload as thumbnail if saved
        if (saveTarget) {
            const file = new File([blob], 'thumbnail.png', { type: 'image/png' })
            await vaultDashboardService.exportThumbnail(file, saveTarget.type, saveTarget.id)
        }
    }
}
```

Add `data-card-preview` attribute to the card render wrapper in `CardPreview.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault-dashboard/preview/ExportCanvas.js src/pages/vault-dashboard/CardCreator.jsx src/pages/vault-dashboard/preview/CardPreview.jsx
git commit -m "feat(vault-dashboard): add PNG export with canvas rendering and thumbnail upload"
```

---

### Task 16: Verify Full Flow End-to-End

- [ ] **Step 1: Start dev server and test complete flow**

```bash
npm start
```

Verify:
1. Navigate to `/vault-dashboard` — Card Creator loads with two-panel layout
2. Template mode: select card type, rarity, holo — preview updates
3. Full Art mode: add image/text/effect layers — preview renders layers
4. Save as template — persists to DB, shows "Saved" indicator
5. Save as draft — persists separately
6. Submit for Review — status changes to "pending_review"
7. Templates page — shows list with filters and status badges
8. Drafts page — shows drafts with notes/rejection reasons
9. Assets page — upload image, browse grid, filter by category
10. Export PNG — downloads file
11. Owner can approve/reject from templates/drafts pages
12. AdminNavbar "More" dropdown shows "Vault Studio" link

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any issues.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(vault-dashboard): polish and verify end-to-end card creator flow"
```

import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, adminHeaders as headers, transaction } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const AI_PROMPT = `You are a SMITE 2 patch notes parser. Given the raw HTML of a patch notes page, extract ALL god and item changes into structured JSON.

Return ONLY raw JSON (no markdown fences, no explanation). The JSON must match this exact structure:

{
  "title": "Open Beta 31",
  "version": "OB31",
  "slug": "ob31",
  "subtitle": "Balance Overview",
  "patch_date": "YYYY-MM-DD",
  "god_changes": [
    {
      "god_name": "Amaterasu",
      "change_type": "buff",
      "abilities": [
        {
          "name": "Divine Presence",
          "slot": "1",
          "changes": [
            { "stat": "Shield Health", "old_value": "4/5/6/7/8%", "new_value": "8% of Max Health" }
          ]
        }
      ],
      "notes": null
    }
  ],
  "item_changes": [
    {
      "item_name": "Kinetic Cuirass",
      "change_type": "new",
      "section": "new_items",
      "cost": "2400g",
      "build_path": "Veve Charm + Plated Metal + 700g",
      "stats": [{ "stat": "Plating", "value": "+15" }, { "stat": "Health", "value": "+300" }],
      "passive_text": "Passive: After being damaged by 5 Attacks from gods..."
    }
  ]
}

Rules:
- Extract EVERY god change and EVERY item change from the page. Do not skip any.
- "title" should be the patch name (e.g. "Open Beta 31")
- "version" should be the short version code (e.g. "OB31")
- "slug" should be a URL-safe lowercase slug (e.g. "ob31")
- "subtitle" is optional flavor text or theme name; use null if not found
- "patch_date" must be YYYY-MM-DD format. Extract from the page if available, otherwise use null.

God change_type values (pick the most accurate):
- "buff" — overall power increase
- "nerf" — overall power decrease
- "adjustment" — mixed changes, neither clearly buff nor nerf
- "rework" — significant ability redesign
- "base_buff" — base stat increase only (no ability changes)
- "base_nerf" — base stat decrease only
- "aspect_nerf" — aspect-specific nerf
- "aspect_buff" — aspect-specific buff
- "buff_aspect_nerf" — god buffed but aspect nerfed

For god abilities:
- "slot" should be "P" for passive, "1" for ability 1, "2" for ability 2, "3" for ability 3, "U" for ultimate, "Base" for base stats, or the aspect name if it's an aspect change
- Each change should have "stat" (what changed), "old_value" (before), and "new_value" (after)
- If old_value is not shown, use null
- "notes" is for dev commentary about the god; use null if none

Item change_type values:
- "new" — brand new item
- "buff" — item made stronger
- "nerf" — item made weaker
- "stat_change" — stats changed but not clearly buff/nerf
- "rework" — significant redesign
- "removed" — item removed from the game
- "shift" — lateral change, power moved around

Item section values:
- "new_items" — newly added items
- "item_balance" — existing item balance changes
- "standard_item_balance" — standard/starter item changes

For items:
- "cost" — item cost if shown (e.g. "2400g"), null if not shown or not applicable
- "build_path" — build path if shown, null otherwise
- "stats" — array of { "stat", "value" } for new items, or { "stat", "old_value", "new_value" } for changed items
- "passive_text" — passive/unique effect text, dev commentary, or any additional text notes that are NOT stat changes (e.g. "God Ability Hits no longer provide triple the Health Heal and Mana Recovery effects."). Include ALL non-stat text. For removed items, include the removal explanation. null only if there is truly no extra text.

Return ONLY the JSON object. No markdown, no code fences, no extra text.`

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const admin = await requirePermission(event, 'league_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()
    const { action, sourceUrl, slug } = JSON.parse(event.body)

    try {
        if (action === 'delete') {
            if (!slug) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug is required' }) }
            }

            const existing = await sql`SELECT id FROM patch_notes WHERE slug = ${slug}`
            if (existing.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Patch note not found' }) }
            }

            const patchId = existing[0].id
            await sql`DELETE FROM patch_note_god_changes WHERE patch_note_id = ${patchId}`
            await sql`DELETE FROM patch_note_item_changes WHERE patch_note_id = ${patchId}`
            await sql`DELETE FROM patch_notes WHERE id = ${patchId}`

            event.waitUntil(logAudit(sql, admin, {
                action: 'delete-patchnote',
                endpoint: 'patchnotes-import',
                targetType: 'patch_note',
                targetId: patchId,
                details: { slug },
            }))

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: slug }) }
        }

        if (action === 'import') {
            if (!sourceUrl) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'sourceUrl is required' }) }
            }

            // Fetch the SmitePrime page HTML
            const pageResponse = await fetch(sourceUrl)
            if (!pageResponse.ok) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Failed to fetch source page: ${pageResponse.status}` }) }
            }
            const html = await pageResponse.text()

            // Send HTML to Claude for structured extraction
            const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 8000,
                    messages: [{ role: 'user', content: `${AI_PROMPT}\n\nHere is the HTML to parse:\n\n${html}` }],
                }),
            })

            if (!aiResponse.ok) {
                const errText = await aiResponse.text()
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI extraction failed', details: errText }) }
            }

            const aiResult = await aiResponse.json()
            const rawText = aiResult.content[0].text

            let data
            try {
                data = JSON.parse(rawText)
            } catch {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse AI response as JSON', raw: rawText.slice(0, 500) }) }
            }

            const godChanges = data.god_changes || []
            const itemChanges = data.item_changes || []

            // Insert into database
            const patchNote = await transaction(async (tx) => {
                const buff_count = godChanges.filter(g => g.change_type.includes('buff')).length
                const nerf_count = godChanges.filter(g => g.change_type.includes('nerf')).length
                const new_item_count = itemChanges.filter(i => i.change_type === 'new').length
                const rework_count = itemChanges.filter(i => i.change_type === 'rework').length

                // Delete existing if re-importing
                const existing = await tx`SELECT id FROM patch_notes WHERE slug = ${data.slug}`
                if (existing.length > 0) {
                    await tx`DELETE FROM patch_note_god_changes WHERE patch_note_id = ${existing[0].id}`
                    await tx`DELETE FROM patch_note_item_changes WHERE patch_note_id = ${existing[0].id}`
                    await tx`DELETE FROM patch_notes WHERE id = ${existing[0].id}`
                }

                // Insert main patch note
                const [inserted] = await tx`
                    INSERT INTO patch_notes (slug, title, version, subtitle, patch_date, source_url, buff_count, nerf_count, new_item_count, rework_count)
                    VALUES (${data.slug}, ${data.title}, ${data.version}, ${data.subtitle}, ${data.patch_date}, ${sourceUrl}, ${buff_count}, ${nerf_count}, ${new_item_count}, ${rework_count})
                    RETURNING *
                `

                // Match god names to gods table
                const gods = await tx`SELECT id, name FROM gods`
                const godMap = {}
                gods.forEach(g => { godMap[g.name.toLowerCase()] = g.id })

                // Insert god changes
                for (let i = 0; i < godChanges.length; i++) {
                    const gc = godChanges[i]
                    const god_id = godMap[gc.god_name.toLowerCase()] || null
                    await tx`
                        INSERT INTO patch_note_god_changes (patch_note_id, god_name, god_id, change_type, abilities, notes, sort_order)
                        VALUES (${inserted.id}, ${gc.god_name}, ${god_id}, ${gc.change_type}, ${JSON.stringify(gc.abilities)}, ${gc.notes}, ${i})
                    `
                }

                // Insert item changes
                for (let i = 0; i < itemChanges.length; i++) {
                    const ic = itemChanges[i]
                    await tx`
                        INSERT INTO patch_note_item_changes (patch_note_id, item_name, change_type, section, cost, build_path, stats, passive_text, sort_order)
                        VALUES (${inserted.id}, ${ic.item_name}, ${ic.change_type}, ${ic.section}, ${ic.cost}, ${ic.build_path}, ${JSON.stringify(ic.stats)}, ${ic.passive_text}, ${i})
                    `
                }

                return inserted
            })

            event.waitUntil(logAudit(sql, admin, {
                action: 'import-patchnote',
                endpoint: 'patchnotes-import',
                targetType: 'patch_note',
                targetId: patchNote.id,
                details: { slug: data.slug, sourceUrl, godCount: godChanges.length, itemCount: itemChanges.length },
            }))

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    patchNote: {
                        id: patchNote.id,
                        slug: patchNote.slug,
                        title: patchNote.title,
                        version: patchNote.version,
                        god_changes_count: godChanges.length,
                        item_changes_count: itemChanges.length,
                    },
                }),
            }
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use "import" or "delete".' }) }
    } catch (err) {
        console.error('patchnotes-import error:', err)
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
}

export const onRequest = adapt(handler)

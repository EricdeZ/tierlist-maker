// One-time script to import patch notes from SmitePrime
// Usage: node scripts/import-patchnotes.mjs <smiteprime-url>
import { neon, Client, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { readFileSync } from 'fs'

// Load .dev.vars
const vars = readFileSync('.dev.vars', 'utf8')
const env = {}
vars.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key?.trim()) env[key.trim()] = rest.join('=').trim()
})

const DATABASE_URL = env.DATABASE_URL
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
const sourceUrl = process.argv[2] || 'https://smiteprime.com/blog/19'
const localFile = process.argv[3] // optional: path to pre-rendered text content

if (!DATABASE_URL || !ANTHROPIC_API_KEY) {
    console.error('Missing DATABASE_URL or ANTHROPIC_API_KEY in .dev.vars')
    process.exit(1)
}

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
- Extract EVERY god change and EVERY item change. Do not skip any.
- god change_type: "buff", "nerf", "adjustment", "rework", "base_buff", "base_nerf", "aspect_nerf", "aspect_buff", "buff_aspect_nerf"
- item change_type: "new", "buff", "nerf", "stat_change", "rework", "removed", "shift"
- item section: "new_items", "item_balance", "standard_item_balance"
- For abilities: slot should be "P" for passive, "1"-"3" for abilities, "4" or "U" for ultimate, "Base" for base stats, or the aspect name
- For items with stat changes (not new): use { "stat", "old_value", "new_value" } in stats array
- For new items: use { "stat", "value" } in stats array
- passive_text: include the label (Passive:/Active:/New Passive:) at the start
- notes: dev commentary about the god, null if none
- Return ONLY the JSON object.`

async function main() {
    let html
    if (localFile) {
        console.log(`Reading local file ${localFile}...`)
        html = readFileSync(localFile, 'utf8')
    } else {
        console.log(`Fetching ${sourceUrl}...`)
        const pageResponse = await fetch(sourceUrl)
        if (!pageResponse.ok) {
            console.error(`Failed to fetch: ${pageResponse.status}`)
            process.exit(1)
        }
        html = await pageResponse.text()
    }
    console.log(`Got ${html.length} bytes of content`)

    console.log('Sending to Claude for extraction...')
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            messages: [{ role: 'user', content: `${AI_PROMPT}\n\nHere is the HTML to parse:\n\n${html}` }],
        }),
    })

    if (!aiResponse.ok) {
        console.error('AI request failed:', await aiResponse.text())
        process.exit(1)
    }

    const aiResult = await aiResponse.json()
    const rawText = aiResult.content[0].text
    console.log('AI response received, parsing...')

    let data
    try {
        data = JSON.parse(rawText)
    } catch (e) {
        console.error('Failed to parse JSON:', rawText.slice(0, 500))
        process.exit(1)
    }

    console.log(`Parsed: ${data.title} (${data.version})`)
    console.log(`  ${data.god_changes?.length || 0} god changes`)
    console.log(`  ${data.item_changes?.length || 0} item changes`)

    // Insert into database using transaction
    neonConfig.webSocketConstructor = ws
    const client = new Client(DATABASE_URL)
    await client.connect()

    try {
        await client.query('BEGIN')

        const godChanges = data.god_changes || []
        const itemChanges = data.item_changes || []
        const buff_count = godChanges.filter(g => g.change_type.includes('buff')).length
        const nerf_count = godChanges.filter(g => g.change_type.includes('nerf')).length
        const new_item_count = itemChanges.filter(i => i.change_type === 'new').length
        const rework_count = itemChanges.filter(i => i.change_type === 'rework').length

        // Delete existing
        const existing = await client.query('SELECT id FROM patch_notes WHERE slug = $1', [data.slug])
        if (existing.rows.length > 0) {
            const id = existing.rows[0].id
            await client.query('DELETE FROM patch_note_god_changes WHERE patch_note_id = $1', [id])
            await client.query('DELETE FROM patch_note_item_changes WHERE patch_note_id = $1', [id])
            await client.query('DELETE FROM patch_notes WHERE id = $1', [id])
            console.log('  Deleted existing patch note for re-import')
        }

        // Insert main patch note
        const pnResult = await client.query(
            `INSERT INTO patch_notes (slug, title, version, subtitle, patch_date, source_url, buff_count, nerf_count, new_item_count, rework_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [data.slug, data.title, data.version, data.subtitle, data.patch_date, sourceUrl, buff_count, nerf_count, new_item_count, rework_count]
        )
        const patchNote = pnResult.rows[0]
        console.log(`  Inserted patch_notes id=${patchNote.id}`)

        // Match gods
        const godsResult = await client.query('SELECT id, name FROM gods')
        const godMap = {}
        godsResult.rows.forEach(g => { godMap[g.name.toLowerCase()] = g.id })

        // Insert god changes
        for (let i = 0; i < godChanges.length; i++) {
            const gc = godChanges[i]
            const god_id = godMap[gc.god_name.toLowerCase()] || null
            await client.query(
                `INSERT INTO patch_note_god_changes (patch_note_id, god_name, god_id, change_type, abilities, notes, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [patchNote.id, gc.god_name, god_id, gc.change_type, JSON.stringify(gc.abilities), gc.notes, i]
            )
        }
        console.log(`  Inserted ${godChanges.length} god changes`)

        // Insert item changes
        for (let i = 0; i < itemChanges.length; i++) {
            const ic = itemChanges[i]
            await client.query(
                `INSERT INTO patch_note_item_changes (patch_note_id, item_name, change_type, section, cost, build_path, stats, passive_text, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [patchNote.id, ic.item_name, ic.change_type, ic.section, ic.cost, ic.build_path, JSON.stringify(ic.stats), ic.passive_text, i]
            )
        }
        console.log(`  Inserted ${itemChanges.length} item changes`)

        await client.query('COMMIT')
        console.log('\nDone! Import successful.')
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('Transaction failed:', err)
        process.exit(1)
    } finally {
        await client.end()
    }
}

main()

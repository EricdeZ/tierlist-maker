import { readFileSync, writeFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_nkrwtszq4gU7@ep-snowy-moon-aedv39lo-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const sql = neon(DATABASE_URL)

// Proper CSV parser that handles quoted fields (including newlines inside quotes)
function parseCSV(content) {
    const rows = []
    let row = []
    let field = ''
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
        const c = content[i]
        const next = content[i + 1]

        if (inQuotes) {
            if (c === '"' && next === '"') {
                field += '"'
                i++
            } else if (c === '"') {
                inQuotes = false
            } else {
                field += c
            }
        } else {
            if (c === '"') {
                inQuotes = true
            } else if (c === ',') {
                row.push(field)
                field = ''
            } else if (c === '\n') {
                row.push(field)
                field = ''
                if (row.some(f => f.length > 0)) rows.push(row)
                row = []
            } else if (c === '\r') {
                // skip
            } else {
                field += c
            }
        }
    }
    // last row
    if (field.length > 0 || row.length > 0) {
        row.push(field)
        if (row.some(f => f.length > 0)) rows.push(row)
    }

    return rows
}

function slugify(name) {
    return name.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function escapeCSVField(val) {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
}

async function main() {
    const content = readFileSync('./tanuki.csv', 'utf-8')
    const rows = parseCSV(content)

    const header = rows[0]
    const dataRows = rows.slice(1)

    console.log(`Parsed ${dataRows.length} player rows from tanuki.csv`)

    const duplicateRows = []
    const insertedNames = []
    const skippedNames = []

    for (const row of dataRows) {
        // Columns: Horodateur, Discord Username, Smite 2 IGN, Tracker Link,
        //          Primary Role, Secondary Role, Tertiary Role, Highest Rank,
        //          Current SR, Experience, Smite2 Experience, Days Available, Notes
        const discordUsername = (row[1] || '').trim()
        const ign = (row[2] || '').trim()
        const trackerUrl = (row[3] || '').trim()
        const primaryRole = (row[4] || '').trim()
        const secondaryRole = (row[5] || '').trim()

        if (!ign) {
            console.warn('  Skipping row with empty IGN')
            continue
        }

        const slug = slugify(ign)
        if (!slug) {
            console.warn(`  Skipping unmappable IGN: "${ign}"`)
            skippedNames.push(ign)
            continue
        }

        // Check for existing player by slug
        const existing = await sql`
            SELECT id, name FROM players WHERE slug = ${slug}
        `

        if (existing.length > 0) {
            console.log(`  DUPLICATE: "${ign}" (slug: ${slug}) — matches existing player #${existing[0].id} "${existing[0].name}"`)
            duplicateRows.push(row)
        } else {
            const name = ign
            const discordName = discordUsername || null
            const tracker = trackerUrl || null
            const mainRole = primaryRole || null
            const secRole = secondaryRole || null

            await sql`
                INSERT INTO players (name, slug, discord_name, tracker_url, main_role, secondary_role)
                VALUES (${name}, ${slug}, ${discordName}, ${tracker}, ${mainRole}, ${secRole})
            `
            console.log(`  INSERTED: "${name}" (slug: ${slug})`)
            insertedNames.push(name)
        }
    }

    // Write duplicates CSV
    if (duplicateRows.length > 0) {
        const headerLine = header.map(escapeCSVField).join(',')
        const dupLines = duplicateRows.map(row => row.map(escapeCSVField).join(','))
        writeFileSync('./Tanuki-duplicated.csv', [headerLine, ...dupLines].join('\n'), 'utf-8')
        console.log(`\n${duplicateRows.length} duplicate(s) written to Tanuki-duplicated.csv`)
    } else {
        console.log('\nNo duplicates found.')
    }

    console.log(`${insertedNames.length} player(s) inserted.`)
    if (skippedNames.length > 0) {
        console.log(`${skippedNames.length} row(s) skipped (unmappable IGN).`)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})

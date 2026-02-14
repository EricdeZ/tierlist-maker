#!/usr/bin/env node
/**
 * One-off script to import players from osl.csv into the players table.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/import-osl-players.mjs
 *
 * Or with dotenv if you have a .env file:
 *   node --env-file=.env scripts/import-osl-players.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = resolve(__dirname, '..', 'osl.csv')

// ─── CSV Parsing (handles quoted fields with commas) ───
function parseCSVLine(line) {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++ // skip escaped quote
            } else {
                inQuotes = !inQuotes
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim())
            current = ''
        } else {
            current += ch
        }
    }
    fields.push(current.trim())
    return fields
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'
}

// Normalize role to match existing convention (capitalize first letter)
function normalizeRole(role) {
    if (!role) return null
    const r = role.trim()
    if (!r) return null
    // Map common variations
    const map = {
        'adc': 'ADC',
        'mid': 'Mid',
        'solo': 'Solo',
        'jungle': 'Jungle',
        'support': 'Support',
        'fill': 'Fill',
    }
    return map[r.toLowerCase()] || r
}

// For secondary roles, keep as comma-separated string
function normalizeSecondaryRoles(raw) {
    if (!raw) return null
    const parts = raw.split(',').map(r => normalizeRole(r.trim())).filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('ERROR: DATABASE_URL env var is required')
        process.exit(1)
    }

    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })

    const raw = readFileSync(CSV_PATH, 'utf-8')
    const lines = raw.split(/\r?\n/).filter(l => l.trim())
    const header = parseCSVLine(lines[0])
    console.log('CSV headers:', header.slice(0, 10))

    // Column indices (0-based):
    // 1=Division, 2=Discord Tag, 3=Smite 2 IGN, 4=Tracker URL, 7=Primary Role
    const COL_DISCORD = 2
    const COL_IGN = 3
    const COL_TRACKER = 4
    const COL_PRIMARY_ROLE = 7

    const players = []
    const seen = new Set()

    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i])
        const ign = (fields[COL_IGN] || '').trim()
        if (!ign) continue

        const slug = slugify(ign)
        // Dedupe within the CSV (same IGN appears only once)
        if (seen.has(slug)) {
            console.log(`  SKIP duplicate in CSV: "${ign}" (slug: ${slug})`)
            continue
        }
        seen.add(slug)

        players.push({
            name: ign,
            slug,
            discord_name: (fields[COL_DISCORD] || '').trim() || null,
            tracker_url: (fields[COL_TRACKER] || '').trim() || null,
            main_role: normalizeRole(fields[COL_PRIMARY_ROLE]),
        })
    }

    console.log(`\nParsed ${players.length} unique players from CSV`)

    // Check which slugs already exist
    const existingRows = await sql`SELECT id, slug, name FROM players WHERE slug = ANY(${players.map(p => p.slug)})`
    const existingBySlug = Object.fromEntries(existingRows.map(r => [r.slug, r]))

    const toInsert = players.filter(p => !existingBySlug[p.slug])
    const toUpdate = players.filter(p => existingBySlug[p.slug])

    console.log(`Already exist (will update): ${toUpdate.length}`)
    console.log(`New (will insert): ${toInsert.length}`)

    let inserted = 0
    let updated = 0
    let errors = 0

    // Update existing players' tracker, discord, roles
    for (const p of toUpdate) {
        try {
            const existing = existingBySlug[p.slug]
            await sql`
                UPDATE players
                SET discord_name = ${p.discord_name},
                    tracker_url = ${p.tracker_url},
                    main_role = ${p.main_role},
                    secondary_role = NULL,
                    updated_at = NOW()
                WHERE id = ${existing.id}
            `
            updated++
        } catch (err) {
            console.error(`  ERROR updating "${p.name}":`, err.message)
            errors++
        }
    }

    // Insert new players (with slug collision handling)
    for (const p of toInsert) {
        try {
            let finalSlug = p.slug
            const [slugConflict] = await sql`SELECT 1 FROM players WHERE slug = ${finalSlug} LIMIT 1`
            if (slugConflict) {
                for (let n = 2; n < 100; n++) {
                    const candidate = `${p.slug}-${n}`
                    const [conflict] = await sql`SELECT 1 FROM players WHERE slug = ${candidate} LIMIT 1`
                    if (!conflict) { finalSlug = candidate; break }
                }
            }

            await sql`
                INSERT INTO players (name, slug, discord_name, tracker_url, main_role)
                VALUES (${p.name}, ${finalSlug}, ${p.discord_name}, ${p.tracker_url}, ${p.main_role})
            `
            inserted++
        } catch (err) {
            console.error(`  ERROR inserting "${p.name}":`, err.message)
            errors++
        }
    }

    console.log(`\nDone! Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`)
    await sql.end()
}

main().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
})

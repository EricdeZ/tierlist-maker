#!/usr/bin/env node
import postgres from 'postgres'

const teams = [
    { name: 'Boo House', color: '#7148ac' },
    { name: "Boy's Night Out", color: '#DF2372' },
    { name: 'Cyberpunk Otters', color: '#189bcc' },
    { name: 'Djungelskogs', color: '#1f51ff' },
    { name: 'Eternal Vanguard', color: '#f80202' },
    { name: 'Fallen Angels', color: '#36135a' },
    { name: 'Food Fighters', color: '#f6ba04' },
    { name: 'Going Ghost', color: '#BA9FFF' },
    { name: 'Kitsune', color: '#e91e63' },
    { name: 'Kittens With Mittens', color: '#FF2BDF' },
    { name: 'Royal Jesters', color: '#FFAFE7' },
    { name: 'The Crew', color: '#7CFC00' },
    { name: 'The Kings Court', color: '#f9a01b' },
    { name: 'The Sewer', color: '#90ee90' },
    { name: 'Wailing Banshees', color: '#000000' },
    { name: 'Warriors of Albion', color: '#0B5D1E' },
]

const seasonIds = [7, 8, 9, 10] // Athens, Sparta, Delphi, Crete (Season 8)

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'
}

async function main() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })

    let created = 0
    for (const sid of seasonIds) {
        for (const t of teams) {
            const slug = slugify(t.name)
            await sql`
                INSERT INTO teams (name, slug, color, season_id)
                VALUES (${t.name}, ${slug}, ${t.color}, ${sid})
            `
            created++
        }
    }

    console.log(`Created ${created} teams across ${seasonIds.length} seasons`)
    await sql.end()
}

main().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
})

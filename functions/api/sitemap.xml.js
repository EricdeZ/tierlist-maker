// functions/api/sitemap.xml.js — Dynamic sitemap generation
import { adapt } from '../lib/adapter.js'
import { getDB } from '../lib/db.js'

const SITE_URL = 'https://smitecomp.com'

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function urlEntry(loc, changefreq = 'weekly', priority = '0.5', lastmod = null) {
    let entry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>`
    if (lastmod) {
        entry += `\n    <lastmod>${lastmod}</lastmod>`
    }
    return entry + '\n  </url>'
}

export const onRequest = adapt(async (event) => {
    const sql = getDB()

    // Static pages
    const urls = [
        urlEntry(`${SITE_URL}/`, 'daily', '1.0'),
        urlEntry(`${SITE_URL}/leagues`, 'weekly', '0.8'),
        urlEntry(`${SITE_URL}/draft`, 'monthly', '0.7'),
        urlEntry(`${SITE_URL}/tierlist`, 'monthly', '0.7'),
        urlEntry(`${SITE_URL}/god-tierlist`, 'monthly', '0.7'),
        urlEntry(`${SITE_URL}/forge`, 'daily', '0.7'),
        urlEntry(`${SITE_URL}/leaderboard`, 'daily', '0.5'),
        urlEntry(`${SITE_URL}/challenges`, 'weekly', '0.5'),
        urlEntry(`${SITE_URL}/scrims`, 'daily', '0.5'),
        urlEntry(`${SITE_URL}/features`, 'monthly', '0.5'),
        urlEntry(`${SITE_URL}/twitch`, 'daily', '0.4'),
        urlEntry(`${SITE_URL}/shop`, 'weekly', '0.3'),
        urlEntry(`${SITE_URL}/arcade`, 'weekly', '0.3'),
    ]

    try {
        // Fetch leagues with active divisions
        const leagues = await sql`
            SELECT DISTINCT l.slug, l.name
            FROM leagues l
            JOIN divisions d ON d.league_id = l.id
            JOIN seasons s ON s.division_id = d.id AND s.is_active = true
            ORDER BY l.name
        `

        for (const league of leagues) {
            urls.push(urlEntry(`${SITE_URL}/${league.slug}`, 'weekly', '0.8'))
            urls.push(urlEntry(`${SITE_URL}/forge/${league.slug}`, 'daily', '0.6'))
        }

        // Fetch active divisions
        const divisions = await sql`
            SELECT d.slug AS division_slug, l.slug AS league_slug
            FROM divisions d
            JOIN leagues l ON l.id = d.league_id
            JOIN seasons s ON s.division_id = d.id AND s.is_active = true
            ORDER BY l.slug, d.slug
        `

        for (const div of divisions) {
            const base = `${SITE_URL}/${div.league_slug}/${div.division_slug}`
            urls.push(urlEntry(base, 'daily', '0.8'))
            urls.push(urlEntry(`${base}/standings`, 'daily', '0.7'))
            urls.push(urlEntry(`${base}/matches`, 'daily', '0.7'))
            urls.push(urlEntry(`${base}/stats`, 'daily', '0.7'))
            urls.push(urlEntry(`${base}/tierlist`, 'weekly', '0.6'))
            urls.push(urlEntry(`${base}/teams`, 'weekly', '0.6'))
            urls.push(urlEntry(`${SITE_URL}/forge/${div.league_slug}/${div.division_slug}`, 'daily', '0.5'))
        }

        // Fetch claimed player profiles (most valuable for SEO)
        const players = await sql`
            SELECT slug FROM players
            WHERE is_claimed = true AND slug IS NOT NULL
            ORDER BY slug
        `

        for (const player of players) {
            urls.push(urlEntry(`${SITE_URL}/profile/${player.slug}`, 'weekly', '0.6'))
        }

        // Fetch team pages for active divisions
        const teams = await sql`
            SELECT t.slug AS team_slug, d.slug AS division_slug, l.slug AS league_slug
            FROM teams t
            JOIN divisions d ON d.id = t.division_id
            JOIN leagues l ON l.id = d.league_id
            JOIN seasons s ON s.division_id = d.id AND s.is_active = true
            ORDER BY l.slug, d.slug, t.slug
        `

        for (const team of teams) {
            urls.push(urlEntry(
                `${SITE_URL}/${team.league_slug}/${team.division_slug}/teams/${team.team_slug}`,
                'weekly', '0.5'
            ))
        }

        // Fetch organizations
        const orgs = await sql`
            SELECT DISTINCT o.slug
            FROM organizations o
            WHERE o.slug IS NOT NULL
            ORDER BY o.slug
        `

        for (const org of orgs) {
            urls.push(urlEntry(`${SITE_URL}/org/${org.slug}`, 'weekly', '0.5'))
        }
    } catch (err) {
        // If DB fails, still return static pages
        console.error('Sitemap DB error:', err)
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
        body: xml,
    }
})

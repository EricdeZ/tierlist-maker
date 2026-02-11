const SITE_URL = 'https://smitecomp.com'
const DEFAULT_IMAGE = `${SITE_URL}/smite2.png`
const SITE_NAME = 'SMITE 2 Companion'
const DEFAULT_DESCRIPTION =
    'Stats, standings, and tools for community-run SMITE 2 leagues. Track every match, rank players, and simulate drafts.'

// Top-level paths that are NOT league slugs
const RESERVED_PATHS = new Set(['draft', 'tierlist', 'admin', 'profile', '.netlify', 'assets'])

// Static route configs
const STATIC_ROUTES = {
    '/': {
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
    },
    '/draft': {
        title: `Draft Simulator | ${SITE_NAME}`,
        description:
            'Practice pick/ban strategy with the full SMITE 2 god pool. Supports Regular, Fearless, and multi-game series formats.',
    },
    '/tierlist': {
        title: `Player Tier Lists | ${SITE_NAME}`,
        description:
            'Rank players by role with drag-and-drop. Export as shareable images and compare your rankings.',
    },
}

const DIVISION_SUB_PAGES = {
    standings: 'Standings',
    matches: 'Matches',
    stats: 'Stats',
    rankings: 'Rankings',
    teams: 'Teams',
}

const API_BASE = `${SITE_URL}/.netlify/functions`

// ── Helpers ──

async function apiFetch(endpoint, params = {}) {
    const url = new URL(`${API_BASE}/${endpoint}`)
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
    }
    try {
        const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

function escapeAttr(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function titleCase(slug) {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

function defaults(path) {
    return {
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

// ── Route resolvers ──

async function resolveLeague(leagueSlug, path) {
    const league = await apiFetch('leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const divCount = league.divisions?.length || 0
    return {
        title: `${league.name} | ${SITE_NAME}`,
        description:
            league.description ||
            `${league.name} – ${divCount} division${divCount !== 1 ? 's' : ''} of competitive SMITE 2.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivision(leagueSlug, divisionSlug, path) {
    const league = await apiFetch('leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const division = league.divisions?.find((d) => d.slug === divisionSlug)
    if (!division) return defaults(path)

    const activeSeason = division.seasons?.find((s) => s.is_active)
    const seasonLabel = activeSeason ? ` – ${activeSeason.name}` : ''

    return {
        title: `${division.name} - ${league.name} | ${SITE_NAME}`,
        description: `${division.name} division of ${league.name}${seasonLabel}. View standings, matches, stats, and player rankings.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionSubPage(leagueSlug, divisionSlug, subPage, path) {
    const league = await apiFetch('leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const division = league.divisions?.find((d) => d.slug === divisionSlug)
    if (!division) return defaults(path)

    const label = DIVISION_SUB_PAGES[subPage]
    return {
        title: `${label} - ${division.name} | ${SITE_NAME}`,
        description: `${label} for the ${division.name} division of ${league.name}.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveMatch(matchId, path) {
    const match = await apiFetch('match-detail', { matchId })
    if (!match?.id) return defaults(path)

    const score = match.is_completed
        ? ` (${match.team1_game_wins ?? 0}-${match.team2_game_wins ?? 0})`
        : ''

    return {
        title: `${match.team1_name} vs ${match.team2_name}${score} | ${SITE_NAME}`,
        description: `Match details: ${match.team1_name} vs ${match.team2_name}${score}. View game-by-game stats and player performances.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolvePlayerProfile(playerSlug, path) {
    const data = await apiFetch('player-profile', { slug: playerSlug })
    if (!data?.player) return defaults(path)

    const p = data.player
    const stats = data.allTimeStats
    const gamesPlayed = stats?.games_played || 0
    const leagueCount = data.leagueBreakdowns?.length || 0

    let description = `${p.name}'s competitive SMITE 2 profile.`
    if (gamesPlayed > 0 && stats.total_deaths > 0) {
        const kda = ((stats.total_kills + stats.total_assists / 2) / stats.total_deaths).toFixed(1)
        description = `${p.name} – ${gamesPlayed} games across ${leagueCount} league${leagueCount !== 1 ? 's' : ''}. KDA: ${kda}.`
    }

    return {
        title: `${p.name} - Player Profile | ${SITE_NAME}`,
        description,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionPlayer(leagueSlug, divisionSlug, playerSlug, path) {
    const [league, profileData] = await Promise.all([
        apiFetch('leagues', { slug: leagueSlug }),
        apiFetch('player-profile', { slug: playerSlug }),
    ])

    const division = league?.divisions?.find((d) => d.slug === divisionSlug)
    const playerName = profileData?.player?.name || titleCase(playerSlug)
    const divisionName = division?.name || titleCase(divisionSlug)

    return {
        title: `${playerName} - ${divisionName} | ${SITE_NAME}`,
        description: `${playerName}'s stats and match history in the ${divisionName} division.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionTeam(leagueSlug, divisionSlug, teamSlug, path) {
    const league = await apiFetch('leagues', { slug: leagueSlug })
    const division = league?.divisions?.find((d) => d.slug === divisionSlug)

    const divisionName = division?.name || titleCase(divisionSlug)
    const teamName = titleCase(teamSlug)

    return {
        title: `${teamName} - ${divisionName} | ${SITE_NAME}`,
        description: `${teamName} roster and match history in the ${divisionName} division.`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

// ── Main resolver ──

async function resolveOGTags(path) {
    // Static routes
    if (STATIC_ROUTES[path]) {
        return {
            ...STATIC_ROUTES[path],
            image: DEFAULT_IMAGE,
            url: `${SITE_URL}${path}`,
        }
    }

    // Admin pages
    if (path.startsWith('/admin')) {
        return { ...defaults(path), title: `Admin | ${SITE_NAME}`, noindex: true }
    }

    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return defaults(path)

    // /profile/:playerSlug
    if (segments[0] === 'profile' && segments[1]) {
        return resolvePlayerProfile(segments[1], path)
    }

    // Reserved top-level paths
    if (RESERVED_PATHS.has(segments[0])) return defaults(path)

    const leagueSlug = segments[0]

    // /:leagueSlug
    if (segments.length === 1) return resolveLeague(leagueSlug, path)

    const divisionSlug = segments[1]

    // /:leagueSlug/:divisionSlug/...
    if (segments.length >= 3) {
        const subPage = segments[2]

        if (subPage === 'matches' && segments[3]) {
            return resolveMatch(segments[3], path)
        }
        if (subPage === 'players' && segments[3]) {
            return resolveDivisionPlayer(leagueSlug, divisionSlug, segments[3], path)
        }
        if (subPage === 'teams' && segments[3]) {
            return resolveDivisionTeam(leagueSlug, divisionSlug, segments[3], path)
        }
        if (DIVISION_SUB_PAGES[subPage]) {
            return resolveDivisionSubPage(leagueSlug, divisionSlug, subPage, path)
        }
    }

    // /:leagueSlug/:divisionSlug
    if (segments.length === 2) return resolveDivision(leagueSlug, divisionSlug, path)

    return defaults(path)
}

// ── HTML injection ──

function injectOGTags(html, tags) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(tags.title)}</title>`)

    const replacements = [
        [/(<meta property="og:title" content=")[^"]*"/, `$1${escapeAttr(tags.title)}"`],
        [/(<meta property="og:description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
        [/(<meta property="og:url" content=")[^"]*"/, `$1${escapeAttr(tags.url)}"`],
        [/(<meta property="og:image" content=")[^"]*"/, `$1${escapeAttr(tags.image)}"`],
        [/(<meta name="description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
        [/(<meta name="twitter:title" content=")[^"]*"/, `$1${escapeAttr(tags.title)}"`],
        [/(<meta name="twitter:description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
    ]

    for (const [pattern, replacement] of replacements) {
        html = html.replace(pattern, replacement)
    }

    if (tags.noindex) {
        html = html.replace(
            /<meta name="robots" content="[^"]*"/,
            '<meta name="robots" content="noindex, nofollow"'
        )
    }

    return html
}

// ── Edge Function entry point ──

export default async (request, context) => {
    const url = new URL(request.url)
    const path = url.pathname

    // Skip non-page requests
    if (path.match(/\.\w{2,5}$/) && !path.endsWith('.html')) {
        return context.next()
    }

    const response = await context.next()
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
        return response
    }

    let tags
    try {
        tags = await resolveOGTags(path)
    } catch {
        tags = defaults(path)
    }

    const html = await response.text()
    const injected = injectOGTags(html, tags)

    return new Response(injected, {
        status: response.status,
        headers: response.headers,
    })
}

export const config = {
    path: '/*',
    excludedPath: [
        '/.netlify/*',
        '/assets/*',
        '/*.js',
        '/*.css',
        '/*.png',
        '/*.jpg',
        '/*.svg',
        '/*.ico',
        '/*.woff',
        '/*.woff2',
        '/robots.txt',
        '/sitemap.xml',
    ],
}

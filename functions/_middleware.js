// Cloudflare Pages Middleware — SEO meta tags injection + env setup
const SITE_URL = 'https://smitecomp.com'
const DEFAULT_IMAGE = `${SITE_URL}/smitecomp.png`
const SITE_NAME = 'SMITE 2 Companion'
const DEFAULT_DESCRIPTION =
    'The ultimate SMITE 2 competitive companion. Live standings, player stats, match history, tier lists, and draft simulator for community SMITE 2 leagues. Track KDA, damage, win rates, and more.'
const DEFAULT_KEYWORDS =
    'SMITE 2, SMITE 2 stats, SMITE 2 tracker, SMITE 2 competitive, SMITE 2 esports, SMITE 2 builds, SMITE 2 gods, SMITE 2 tier list, SMITE 2 draft, SMITE 2 league, SMITE competitive, smitecomp'

const RESERVED_PATHS = new Set(['draft', 'tierlist', 'admin', 'profile', 'api', 'assets', 'leaderboard', 'challenges', 'coinflip', 'shop', 'predictions', 'matchup', 'leagues', 'twitch'])

const STATIC_ROUTES = {
    '/': {
        title: `${SITE_NAME} - Stats, Standings & Tools for Competitive SMITE 2`,
        description: DEFAULT_DESCRIPTION,
        keywords: DEFAULT_KEYWORDS,
    },
    '/draft': {
        title: `SMITE 2 Draft Simulator - Practice Picks & Bans | ${SITE_NAME}`,
        description:
            'Free SMITE 2 draft simulator. Practice pick/ban strategy with every god. Supports Regular, Fearless, and multi-game series formats. Plan your competitive SMITE 2 drafts.',
        keywords: 'SMITE 2 draft, SMITE 2 draft simulator, SMITE 2 picks and bans, SMITE 2 gods, SMITE 2 fearless draft, SMITE 2 competitive draft, SMITE draft tool',
    },
    '/tierlist': {
        title: `SMITE 2 Player Tier List Maker - Rank Players by Role | ${SITE_NAME}`,
        description:
            'Create and share SMITE 2 player tier lists. Drag-and-drop players by role, export as images, and compare your rankings with the community.',
        keywords: 'SMITE 2 tier list, SMITE 2 player rankings, SMITE 2 tier list maker, SMITE 2 player tier list, SMITE 2 rankings, SMITE tier list',
    },
    '/leagues': {
        title: `All SMITE 2 Leagues - Browse Competitive Leagues | ${SITE_NAME}`,
        description:
            'Browse every tracked SMITE 2 competitive league. View divisions, seasons, standings, and player stats across all community-run SMITE 2 leagues.',
        keywords: 'SMITE 2 leagues, SMITE 2 competitive leagues, SMITE 2 esports leagues, SMITE 2 community leagues, SMITE 2 divisions',
    },
    '/leaderboard': {
        title: `Passion Coin Leaderboard | ${SITE_NAME}`,
        description:
            'See who has earned the most Passion Coins on SMITE 2 Companion. Climb the ranks from Clay to Deity and prove your dedication to competitive SMITE 2.',
        keywords: 'SMITE 2 leaderboard, SMITE 2 Companion leaderboard, Passion Coins, SMITE 2 rankings',
    },
    '/challenges': {
        title: `Challenges - Earn Passion Coins | ${SITE_NAME}`,
        description:
            'Complete challenges to earn Passion Coins and climb the ranks on SMITE 2 Companion. Daily challenges, achievement badges, and career milestones.',
        keywords: 'SMITE 2 challenges, SMITE 2 achievements, Passion Coins, SMITE 2 Companion challenges',
    },
    '/twitch': {
        title: `Featured SMITE 2 Stream | ${SITE_NAME}`,
        description:
            'Watch featured SMITE 2 competitive streams live. Catch community league matches, caster commentary, and competitive gameplay.',
        keywords: 'SMITE 2 stream, SMITE 2 Twitch, SMITE 2 esports stream, SMITE 2 competitive stream',
    },
    '/coinflip': {
        title: `Coin Flip | ${SITE_NAME}`,
        description: 'Flip a coin to decide side selection in competitive SMITE 2 matches.',
        noindex: true,
    },
    '/shop': {
        title: `Passion Shop | ${SITE_NAME}`,
        description: 'Spend your Passion Coins in the SMITE 2 Companion shop.',
        keywords: 'SMITE 2 Companion shop, Passion Coins',
    },
}

const DIVISION_SUB_PAGES = {
    standings: { label: 'Standings', desc: 'standings and win/loss records' },
    matches: { label: 'Matches', desc: 'match history and weekly results' },
    stats: { label: 'Stats', desc: 'player statistics, KDA, damage, and performance analytics' },
    rankings: { label: 'Rankings', desc: 'player tier list rankings by role' },
    teams: { label: 'Teams', desc: 'team rosters and match records' },
}

// ── Helpers ──

async function apiFetch(apiBase, endpoint, params = {}) {
    const url = new URL(`${apiBase}/api/${endpoint}`)
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
        keywords: DEFAULT_KEYWORDS,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

// ── Route resolvers ──

async function resolveLeague(apiBase, leagueSlug, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const divCount = league.divisions?.length || 0
    const activeDivs = league.divisions?.filter(d => d.seasons?.some(s => s.is_active)) || []
    const teamCount = league.divisions?.reduce((sum, d) => sum + (d.team_count || 0), 0) || 0

    return {
        title: `${league.name} - SMITE 2 Competitive League | ${SITE_NAME}`,
        description:
            league.description ||
            `${league.name} – ${divCount} division${divCount !== 1 ? 's' : ''}, ${teamCount} teams of competitive SMITE 2. View standings, stats, match history, and player rankings.`,
        keywords: `${league.name}, SMITE 2 ${league.name}, SMITE 2 competitive league, SMITE 2 standings, SMITE 2 stats, ${activeDivs.map(d => d.name).join(', ')}`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivision(apiBase, leagueSlug, divisionSlug, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const division = league.divisions?.find((d) => d.slug === divisionSlug)
    if (!division) return defaults(path)

    const activeSeason = division.seasons?.find((s) => s.is_active)
    const seasonLabel = activeSeason ? ` – ${activeSeason.name}` : ''
    const teamCount = division.team_count || 0
    const playerCount = division.player_count || 0

    return {
        title: `${division.name} - ${league.name} | ${SITE_NAME}`,
        description: `${division.name} division of ${league.name}${seasonLabel}. ${teamCount} teams, ${playerCount} players. Live standings, match results, player stats, KDA, and rankings.`,
        keywords: `${division.name}, ${league.name}, SMITE 2 ${division.name}, SMITE 2 standings, SMITE 2 stats, SMITE 2 match history, SMITE 2 player stats`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionSubPage(apiBase, leagueSlug, divisionSlug, subPage, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const division = league.divisions?.find((d) => d.slug === divisionSlug)
    if (!division) return defaults(path)

    const sub = DIVISION_SUB_PAGES[subPage]
    return {
        title: `${sub.label} - ${division.name} (${league.name}) | ${SITE_NAME}`,
        description: `View ${sub.desc} for the ${division.name} division of ${league.name}. Competitive SMITE 2 ${sub.label.toLowerCase()} updated after every match.`,
        keywords: `${division.name} ${sub.label.toLowerCase()}, ${league.name} ${sub.label.toLowerCase()}, SMITE 2 ${sub.label.toLowerCase()}, SMITE 2 ${division.name}`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveMatch(apiBase, matchId, path) {
    const match = await apiFetch(apiBase, 'match-detail', { matchId })
    if (!match?.id) return defaults(path)

    const score = match.is_completed
        ? ` (${match.team1_game_wins ?? 0}-${match.team2_game_wins ?? 0})`
        : ''

    return {
        title: `${match.team1_name} vs ${match.team2_name}${score} | ${SITE_NAME}`,
        description: `${match.team1_name} vs ${match.team2_name}${score} match details. Game-by-game stats, player performances, KDA, damage, and mitigated for every player.`,
        keywords: `${match.team1_name}, ${match.team2_name}, SMITE 2 match, SMITE 2 stats, SMITE 2 competitive match`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolvePlayerProfile(apiBase, playerSlug, path) {
    const data = await apiFetch(apiBase, 'player-profile', { slug: playerSlug })
    if (!data?.player) return defaults(path)

    const p = data.player
    const stats = data.allTimeStats
    const gamesPlayed = stats?.games_played || 0
    const leagueCount = data.leagueBreakdowns?.length || 0

    let description = `${p.name}'s competitive SMITE 2 profile on ${SITE_NAME}. View match history, stats, and career performance.`
    if (gamesPlayed > 0 && stats.total_deaths > 0) {
        const kda = ((stats.total_kills + stats.total_assists / 2) / stats.total_deaths).toFixed(1)
        const winRate = stats.wins > 0 ? Math.round((stats.wins / gamesPlayed) * 100) : 0
        description = `${p.name} – ${gamesPlayed} games across ${leagueCount} league${leagueCount !== 1 ? 's' : ''}. KDA: ${kda}, Win Rate: ${winRate}%. Full match history and stats.`
    }

    return {
        title: `${p.name} - SMITE 2 Player Profile & Stats | ${SITE_NAME}`,
        description,
        keywords: `${p.name}, ${p.name} SMITE 2, ${p.name} stats, SMITE 2 player profile, SMITE 2 player stats, SMITE 2 KDA`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionPlayer(apiBase, leagueSlug, divisionSlug, playerSlug, path) {
    const [league, profileData] = await Promise.all([
        apiFetch(apiBase, 'leagues', { slug: leagueSlug }),
        apiFetch(apiBase, 'player-profile', { slug: playerSlug }),
    ])

    const division = league?.divisions?.find((d) => d.slug === divisionSlug)
    const playerName = profileData?.player?.name || titleCase(playerSlug)
    const divisionName = division?.name || titleCase(divisionSlug)
    const leagueName = league?.name || titleCase(leagueSlug)

    return {
        title: `${playerName} - ${divisionName} Stats (${leagueName}) | ${SITE_NAME}`,
        description: `${playerName}'s stats and match history in the ${divisionName} division of ${leagueName}. KDA, damage, win rate, and game-by-game performance.`,
        keywords: `${playerName}, ${playerName} SMITE 2, ${divisionName}, ${leagueName}, SMITE 2 player stats`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

async function resolveDivisionTeam(apiBase, leagueSlug, divisionSlug, teamSlug, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    const division = league?.divisions?.find((d) => d.slug === divisionSlug)

    const divisionName = division?.name || titleCase(divisionSlug)
    const leagueName = league?.name || titleCase(leagueSlug)
    const teamName = titleCase(teamSlug)

    return {
        title: `${teamName} - ${divisionName} (${leagueName}) | ${SITE_NAME}`,
        description: `${teamName} roster, match history, and stats in the ${divisionName} division of ${leagueName}. View player performances and team record.`,
        keywords: `${teamName}, ${teamName} SMITE 2, ${divisionName}, ${leagueName}, SMITE 2 team`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
    }
}

// ── Main resolver ──

async function resolveOGTags(apiBase, path) {
    if (STATIC_ROUTES[path]) {
        return {
            ...STATIC_ROUTES[path],
            image: DEFAULT_IMAGE,
            url: `${SITE_URL}${path}`,
        }
    }

    if (path.startsWith('/admin')) {
        return { ...defaults(path), title: `Admin | ${SITE_NAME}`, noindex: true }
    }

    // Predictions are admin-only, noindex
    if (path.startsWith('/predictions') || path.startsWith('/matchup/')) {
        return { ...defaults(path), noindex: true }
    }

    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return defaults(path)

    if (segments[0] === 'profile' && segments[1]) {
        return resolvePlayerProfile(apiBase, segments[1], path)
    }

    if (RESERVED_PATHS.has(segments[0])) {
        // Check if it's a known static route we already handled
        return defaults(path)
    }

    const leagueSlug = segments[0]

    if (segments.length === 1) return resolveLeague(apiBase, leagueSlug, path)

    const divisionSlug = segments[1]

    if (segments.length >= 3) {
        const subPage = segments[2]

        if (subPage === 'matches' && segments[3]) {
            return resolveMatch(apiBase, segments[3], path)
        }
        if (subPage === 'players' && segments[3]) {
            return resolveDivisionPlayer(apiBase, leagueSlug, divisionSlug, segments[3], path)
        }
        if (subPage === 'teams' && segments[3]) {
            return resolveDivisionTeam(apiBase, leagueSlug, divisionSlug, segments[3], path)
        }
        if (DIVISION_SUB_PAGES[subPage]) {
            return resolveDivisionSubPage(apiBase, leagueSlug, divisionSlug, subPage, path)
        }
    }

    if (segments.length === 2) return resolveDivision(apiBase, leagueSlug, divisionSlug, path)

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
        [/(<meta name="twitter:image" content=")[^"]*"/, `$1${escapeAttr(tags.image)}"`],
        [/(<link rel="canonical" href=")[^"]*"/, `$1${escapeAttr(tags.url)}"`],
    ]

    for (const [pattern, replacement] of replacements) {
        html = html.replace(pattern, replacement)
    }

    // Inject keywords if provided
    if (tags.keywords) {
        html = html.replace(
            /(<meta name="keywords" content=")[^"]*"/,
            `$1${escapeAttr(tags.keywords)}"`
        )
    }

    if (tags.noindex) {
        html = html.replace(
            /<meta name="robots" content="[^"]*"/,
            '<meta name="robots" content="noindex, nofollow"'
        )
    }

    return html
}

// ── Cloudflare Pages Middleware entry point ──

export async function onRequest(context) {
    const { request, env } = context
    const url = new URL(request.url)
    const path = url.pathname

    // Populate process.env from Cloudflare env bindings (for API functions downstream)
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') {
            process.env[key] = value
        }
    }

    // Skip non-page requests (static assets, API calls)
    if (path.startsWith('/api/') || (path.match(/\.\w{2,5}$/) && !path.endsWith('.html'))) {
        return context.next()
    }

    const response = await context.next()
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
        return response
    }

    let tags
    try {
        tags = await resolveOGTags(url.origin, path)
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

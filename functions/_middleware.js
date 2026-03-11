// Cloudflare Pages Middleware — SEO meta tags injection + env setup
const SITE_URL = 'https://smitecomp.com'
const DEFAULT_IMAGE = `${SITE_URL}/smitecomp.png`
const SITE_NAME = 'SMITE 2 Companion'
const DEFAULT_DESCRIPTION =
    'The ultimate SMITE 2 competitive companion. Live standings, player stats, match history, tier lists, and draft simulator for community SMITE 2 leagues. Track KDA, damage, win rates, and more.'
const DEFAULT_KEYWORDS =
    'SMITE 2, SMITE 2 stats, SMITE 2 tracker, SMITE 2 competitive, SMITE 2 esports, SMITE 2 builds, SMITE 2 gods, SMITE 2 tier list, SMITE 2 draft, SMITE 2 league, SMITE competitive, smitecomp'

const FORGE_IMAGE = `${SITE_URL}/forge.png`
const VAULT_IMAGE = `${SITE_URL}/vault-og.png`

const RESERVED_PATHS = new Set(['draft', 'tierlist', 'admin', 'profile', 'api', 'assets', 'leaderboard', 'challenges', 'coinflip', 'shop', 'predictions', 'matchup', 'leagues', 'twitch', 'forge', 'org', 'god-tierlist', 'scrims', 'arcade', 'feedback', 'support', 'features', 'referral', 'agl', 'vault'])

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
        title: `Passion Leaderboard | ${SITE_NAME}`,
        description:
            'See who has earned the most Passion on SMITE 2 Companion. Climb the ranks from Clay to Deity and prove your dedication to competitive SMITE 2.',
        keywords: 'SMITE 2 leaderboard, SMITE 2 Companion leaderboard, Passion, SMITE 2 rankings',
    },
    '/challenges': {
        title: `Challenges - Earn Passion | ${SITE_NAME}`,
        description:
            'Complete challenges to earn Passion and climb the ranks on SMITE 2 Companion. Daily challenges, achievement badges, and career milestones.',
        keywords: 'SMITE 2 challenges, SMITE 2 achievements, Passion, SMITE 2 Companion challenges',
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
        description: 'Spend your Passion in the SMITE 2 Companion shop. Unlock cosmetics, badges, and rewards.',
        keywords: 'SMITE 2 Companion shop, Passion, SMITE 2 rewards',
    },
    '/forge': {
        title: `Fantasy Forge - SMITE 2 Player Investment Market | ${SITE_NAME}`,
        description:
            'Invest Sparks in competitive SMITE 2 players. Buy low, sell high as players perform. Track portfolios, climb leaderboards, and prove your scouting eye.',
        keywords: 'Fantasy Forge, SMITE 2 fantasy, SMITE 2 player market, SMITE 2 investment, Sparks, SMITE 2 competitive',
        image: FORGE_IMAGE,
    },
    '/god-tierlist': {
        title: `SMITE 2 God Tier List - Rank Every God | ${SITE_NAME}`,
        description:
            'Create your personal SMITE 2 god tier list. Rank gods from S to F tier and share your rankings with the community.',
        keywords: 'SMITE 2 god tier list, SMITE 2 tier list, SMITE 2 god rankings, SMITE 2 meta, best SMITE 2 gods',
    },
    '/scrims': {
        title: `Scrim Planner - Find SMITE 2 Scrimmages | ${SITE_NAME}`,
        description:
            'Post and browse SMITE 2 scrim requests. Captains can challenge teams directly or post open scrims for any team to accept.',
        keywords: 'SMITE 2 scrims, SMITE 2 scrimmage, SMITE 2 practice, SMITE 2 scrim finder',
    },
    '/arcade': {
        title: `The Arcade - SMITE 2 Mini-Games | ${SITE_NAME}`,
        description:
            'Play SMITE 2 themed arcade games. Earn XP, compete with friends, and climb the leaderboard.',
        keywords: 'SMITE 2 arcade, SMITE 2 mini-games, SMITE 2 games',
    },
    '/features': {
        title: `Features - Everything on ${SITE_NAME}`,
        description:
            'Explore all features of SMITE 2 Companion: live standings, stats tracking, draft simulator, Fantasy Forge, tier lists, challenges, and more.',
        keywords: 'SMITE 2 Companion features, SMITE 2 tools, SMITE 2 stats platform',
    },
    '/referral': {
        title: `Refer a Friend | ${SITE_NAME}`,
        description: 'Invite friends to SMITE 2 Companion and earn Passion rewards for both of you.',
        keywords: 'SMITE 2 Companion referral, refer a friend, Passion rewards',
    },
    '/vault': {
        title: `The Vault - Collect & Trade SMITE 2 Cards | ${SITE_NAME}`,
        description:
            'Open packs, collect trading cards, build your binder, and trade with other players. The ultimate SMITE 2 card collecting experience.',
        keywords: 'SMITE 2 cards, SMITE 2 trading cards, card collecting, The Vault, SMITE 2 Companion',
        image: VAULT_IMAGE,
        imageWidth: '478',
        imageHeight: '595',
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

function breadcrumbList(items) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    }
}

const HOME_CRUMB = { name: 'Home', url: SITE_URL }
const LEAGUES_CRUMB = { name: 'Leagues', url: `${SITE_URL}/leagues` }
const FORGE_CRUMB = { name: 'Fantasy Forge', url: `${SITE_URL}/forge` }

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
        jsonLd: [breadcrumbList([HOME_CRUMB, LEAGUES_CRUMB, { name: league.name, url: `${SITE_URL}${path}` }])],
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

    const leagueUrl = `${SITE_URL}/${leagueSlug}`
    return {
        title: `${division.name} - ${league.name} | ${SITE_NAME}`,
        description: `${division.name} division of ${league.name}${seasonLabel}. ${teamCount} teams, ${playerCount} players. Live standings, match results, player stats, KDA, and rankings.`,
        keywords: `${division.name}, ${league.name}, SMITE 2 ${division.name}, SMITE 2 standings, SMITE 2 stats, SMITE 2 match history, SMITE 2 player stats`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, LEAGUES_CRUMB, { name: league.name, url: leagueUrl }, { name: division.name, url: `${SITE_URL}${path}` }])],
    }
}

async function resolveDivisionSubPage(apiBase, leagueSlug, divisionSlug, subPage, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    if (!league?.id) return defaults(path)

    const division = league.divisions?.find((d) => d.slug === divisionSlug)
    if (!division) return defaults(path)

    const sub = DIVISION_SUB_PAGES[subPage]
    const leagueUrl = `${SITE_URL}/${leagueSlug}`
    const divisionUrl = `${SITE_URL}/${leagueSlug}/${divisionSlug}`
    return {
        title: `${sub.label} - ${division.name} (${league.name}) | ${SITE_NAME}`,
        description: `View ${sub.desc} for the ${division.name} division of ${league.name}. Competitive SMITE 2 ${sub.label.toLowerCase()} updated after every match.`,
        keywords: `${division.name} ${sub.label.toLowerCase()}, ${league.name} ${sub.label.toLowerCase()}, SMITE 2 ${sub.label.toLowerCase()}, SMITE 2 ${division.name}`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, LEAGUES_CRUMB, { name: league.name, url: leagueUrl }, { name: division.name, url: divisionUrl }, { name: sub.label, url: `${SITE_URL}${path}` }])],
    }
}

async function resolveMatch(apiBase, matchId, path) {
    const match = await apiFetch(apiBase, 'match-detail', { matchId })
    if (!match?.id) return defaults(path)

    const score = match.is_completed
        ? ` (${match.team1_game_wins ?? 0}-${match.team2_game_wins ?? 0})`
        : ''

    const matchUrl = `${SITE_URL}${path}`
    const sportsEvent = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: `${match.team1_name} vs ${match.team2_name}`,
        url: matchUrl,
        eventStatus: match.is_completed ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
        competitor: [
            { '@type': 'SportsTeam', name: match.team1_name },
            { '@type': 'SportsTeam', name: match.team2_name },
        ],
    }

    // Build breadcrumbs from path segments: /:leagueSlug/:divisionSlug/matches/:matchId
    const segments = path.split('/').filter(Boolean)
    const crumbs = [HOME_CRUMB, LEAGUES_CRUMB]
    if (segments.length >= 2) {
        crumbs.push({ name: titleCase(segments[0]), url: `${SITE_URL}/${segments[0]}` })
        crumbs.push({ name: titleCase(segments[1]), url: `${SITE_URL}/${segments[0]}/${segments[1]}` })
        crumbs.push({ name: 'Matches', url: `${SITE_URL}/${segments[0]}/${segments[1]}/matches` })
    }
    crumbs.push({ name: `${match.team1_name} vs ${match.team2_name}`, url: matchUrl })

    return {
        title: `${match.team1_name} vs ${match.team2_name}${score} | ${SITE_NAME}`,
        description: `${match.team1_name} vs ${match.team2_name}${score} match details. Game-by-game stats, player performances, KDA, damage, and mitigated for every player.`,
        keywords: `${match.team1_name}, ${match.team2_name}, SMITE 2 match, SMITE 2 stats, SMITE 2 competitive match`,
        image: DEFAULT_IMAGE,
        url: matchUrl,
        jsonLd: [breadcrumbList(crumbs), sportsEvent],
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

    const profileUrl = `${SITE_URL}${path}`
    const profilePage = {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
            '@type': 'Person',
            name: p.name,
            url: profileUrl,
        },
    }

    return {
        title: `${p.name} - SMITE 2 Player Profile & Stats | ${SITE_NAME}`,
        description,
        keywords: `${p.name}, ${p.name} SMITE 2, ${p.name} stats, SMITE 2 player profile, SMITE 2 player stats, SMITE 2 KDA`,
        image: DEFAULT_IMAGE,
        url: profileUrl,
        jsonLd: [breadcrumbList([HOME_CRUMB, { name: p.name, url: profileUrl }]), profilePage],
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

    const leagueUrl = `${SITE_URL}/${leagueSlug}`
    const divisionUrl = `${SITE_URL}/${leagueSlug}/${divisionSlug}`
    return {
        title: `${playerName} - ${divisionName} Stats (${leagueName}) | ${SITE_NAME}`,
        description: `${playerName}'s stats and match history in the ${divisionName} division of ${leagueName}. KDA, damage, win rate, and game-by-game performance.`,
        keywords: `${playerName}, ${playerName} SMITE 2, ${divisionName}, ${leagueName}, SMITE 2 player stats`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, LEAGUES_CRUMB, { name: leagueName, url: leagueUrl }, { name: divisionName, url: divisionUrl }, { name: playerName, url: `${SITE_URL}${path}` }])],
    }
}

async function resolveDivisionTeam(apiBase, leagueSlug, divisionSlug, teamSlug, path) {
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    const division = league?.divisions?.find((d) => d.slug === divisionSlug)

    const divisionName = division?.name || titleCase(divisionSlug)
    const leagueName = league?.name || titleCase(leagueSlug)
    const teamName = titleCase(teamSlug)

    const leagueUrl = `${SITE_URL}/${leagueSlug}`
    const divisionUrl = `${SITE_URL}/${leagueSlug}/${divisionSlug}`
    const teamsUrl = `${SITE_URL}/${leagueSlug}/${divisionSlug}/teams`
    const teamSchema = {
        '@context': 'https://schema.org',
        '@type': 'SportsTeam',
        name: teamName,
        url: `${SITE_URL}${path}`,
        memberOf: { '@type': 'SportsOrganization', name: leagueName },
    }
    return {
        title: `${teamName} - ${divisionName} (${leagueName}) | ${SITE_NAME}`,
        description: `${teamName} roster, match history, and stats in the ${divisionName} division of ${leagueName}. View player performances and team record.`,
        keywords: `${teamName}, ${teamName} SMITE 2, ${divisionName}, ${leagueName}, SMITE 2 team`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, LEAGUES_CRUMB, { name: leagueName, url: leagueUrl }, { name: divisionName, url: divisionUrl }, { name: 'Teams', url: teamsUrl }, { name: teamName, url: `${SITE_URL}${path}` }]), teamSchema],
    }
}

// ── Forge resolver ──

async function resolveForge(apiBase, segments, path) {
    // /forge — static route handles base
    // /forge/:leagueSlug — league-scoped forge
    // /forge/:leagueSlug/:divisionSlug — division-scoped forge
    // /forge/:leagueSlug/:divisionSlug/player/:playerSlug — player page
    const subPages = new Set(['portfolio', 'leaderboard', 'challenges', 'wiki'])

    if (segments.length < 2) return null // handled by static route

    const leagueSlug = segments[1]
    const league = await apiFetch(apiBase, 'leagues', { slug: leagueSlug })
    const leagueName = league?.name || titleCase(leagueSlug)

    // /forge/:leagueSlug/subpage
    if (segments.length === 2 || (segments.length === 3 && subPages.has(segments[2]))) {
        const sub = segments[2] ? ` - ${titleCase(segments[2])}` : ''
        const crumbs = [HOME_CRUMB, FORGE_CRUMB, { name: leagueName, url: `${SITE_URL}${path}` }]
        return {
            title: `Fantasy Forge${sub} - ${leagueName} | ${SITE_NAME}`,
            description: `Fantasy Forge player investment market for ${leagueName}. Buy and sell shares in competitive SMITE 2 players based on their performance.`,
            keywords: `Fantasy Forge, ${leagueName}, SMITE 2 fantasy, player market, Sparks`,
            image: FORGE_IMAGE,
            url: `${SITE_URL}${path}`,
            jsonLd: [breadcrumbList(crumbs)],
        }
    }

    const divisionSlug = segments[2]
    const division = league?.divisions?.find((d) => d.slug === divisionSlug)
    const divisionName = division?.name || titleCase(divisionSlug)

    const forgeLeagueUrl = `${SITE_URL}/forge/${leagueSlug}`
    const forgeDivUrl = `${SITE_URL}/forge/${leagueSlug}/${divisionSlug}`

    // /forge/:leagueSlug/:divisionSlug/player/:playerSlug
    if (segments[3] === 'player' && segments[4]) {
        const profileData = await apiFetch(apiBase, 'player-profile', { slug: segments[4] })
        const playerName = profileData?.player?.name || titleCase(segments[4])
        return {
            title: `${playerName} - Fantasy Forge (${divisionName}) | ${SITE_NAME}`,
            description: `${playerName}'s Fantasy Forge page in ${divisionName} (${leagueName}). View spark price, bonding curve, trade history, and performance stats.`,
            keywords: `${playerName}, Fantasy Forge, ${divisionName}, ${leagueName}, SMITE 2 player market`,
            image: FORGE_IMAGE,
            url: `${SITE_URL}${path}`,
            jsonLd: [breadcrumbList([HOME_CRUMB, FORGE_CRUMB, { name: leagueName, url: forgeLeagueUrl }, { name: divisionName, url: forgeDivUrl }, { name: playerName, url: `${SITE_URL}${path}` }])],
        }
    }

    // /forge/:leagueSlug/:divisionSlug or /forge/:leagueSlug/:divisionSlug/subpage
    const sub = segments[3] && subPages.has(segments[3]) ? ` - ${titleCase(segments[3])}` : ''
    return {
        title: `Fantasy Forge${sub} - ${divisionName} (${leagueName}) | ${SITE_NAME}`,
        description: `Fantasy Forge player market for ${divisionName} in ${leagueName}. Invest Sparks in players, track your portfolio, and climb the leaderboard.`,
        keywords: `Fantasy Forge, ${divisionName}, ${leagueName}, SMITE 2 fantasy, player market`,
        image: FORGE_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, FORGE_CRUMB, { name: leagueName, url: forgeLeagueUrl }, { name: divisionName, url: forgeDivUrl }])],
    }
}

// ── Org resolver ──

async function resolveOrg(apiBase, orgSlug, path) {
    const orgName = titleCase(orgSlug)
    return {
        title: `${orgName} - Organization | ${SITE_NAME}`,
        description: `${orgName} organization page on SMITE 2 Companion. View all teams, divisions, and player rosters across seasons.`,
        keywords: `${orgName}, SMITE 2 organization, SMITE 2 team, SMITE 2 esports`,
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}${path}`,
        jsonLd: [breadcrumbList([HOME_CRUMB, { name: orgName, url: `${SITE_URL}${path}` }])],
    }
}

// ── Vault resolver ──

const VAULT_CRUMB = { name: 'The Vault', url: `${SITE_URL}/vault` }
const VAULT_DIMS = { imageWidth: '478', imageHeight: '595' }

async function resolveVault(apiBase, segments, path) {
    if (segments.length < 2) return null // handled by static route

    // /vault/share/:token — shared card preview
    if (segments[1] === 'share' && segments[2]) {
        const data = await apiFetch(apiBase, 'vault', { action: 'shared-card', token: segments[2] })
        if (data?.card) {
            const playerName = data.card.playerName || 'Player'
            const teamName = data.card.teamName
            const rarity = data.rarity ? ` ${data.rarity.charAt(0).toUpperCase() + data.rarity.slice(1)}` : ''
            const teamInfo = teamName ? ` (${teamName})` : ''
            return {
                title: `${playerName}${rarity} Card${teamInfo} | The Vault`,
                description: `Check out this${rarity} ${playerName} trading card from The Vault on SMITE 2 Companion.`,
                keywords: `${playerName}, SMITE 2 trading card, The Vault, SMITE 2 cards`,
                image: VAULT_IMAGE,
                ...VAULT_DIMS,
                url: `${SITE_URL}${path}`,
                jsonLd: [breadcrumbList([HOME_CRUMB, VAULT_CRUMB, { name: `${playerName} Card`, url: `${SITE_URL}${path}` }])],
            }
        }
        // Fallback if token is invalid/expired
        return {
            title: `Shared Card | The Vault`,
            description: 'View a shared trading card from The Vault on SMITE 2 Companion.',
            keywords: 'SMITE 2 trading card, The Vault, SMITE 2 cards',
            image: VAULT_IMAGE,
            ...VAULT_DIMS,
            url: `${SITE_URL}${path}`,
        }
    }

    // /vault/binder/:token — shared binder preview
    if (segments[1] === 'binder' && segments[2]) {
        const data = await apiFetch(apiBase, 'vault', { action: 'binder-view', token: segments[2] })
        if (data?.owner) {
            const ownerName = data.owner.username || 'Player'
            const binderName = data.binder?.name || 'Binder'
            const cardCount = data.cards?.length || 0
            return {
                title: `${ownerName}'s ${binderName} | The Vault`,
                description: `Browse ${ownerName}'s ${binderName} with ${cardCount} card${cardCount !== 1 ? 's' : ''} in The Vault on SMITE 2 Companion.`,
                keywords: `${ownerName}, SMITE 2 binder, The Vault, SMITE 2 cards, card collection`,
                image: VAULT_IMAGE,
                ...VAULT_DIMS,
                url: `${SITE_URL}${path}`,
                jsonLd: [breadcrumbList([HOME_CRUMB, VAULT_CRUMB, { name: `${ownerName}'s ${binderName}`, url: `${SITE_URL}${path}` }])],
            }
        }
        return {
            title: `Shared Binder | The Vault`,
            description: 'View a shared binder from The Vault on SMITE 2 Companion.',
            keywords: 'SMITE 2 binder, The Vault, SMITE 2 cards',
            image: VAULT_IMAGE,
            ...VAULT_DIMS,
            url: `${SITE_URL}${path}`,
        }
    }

    return null
}

// ── Main resolver ──

async function resolveOGTags(apiBase, path) {
    if (STATIC_ROUTES[path]) {
        const route = STATIC_ROUTES[path]
        const result = {
            ...route,
            image: route.image || DEFAULT_IMAGE,
            url: `${SITE_URL}${path}`,
        }
        // Add breadcrumbs for non-homepage static routes
        if (path !== '/') {
            const pageName = route.title.split(' | ')[0].split(' - ')[0]
            result.jsonLd = [breadcrumbList([HOME_CRUMB, { name: pageName, url: `${SITE_URL}${path}` }])]
        }
        return result
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

    if (segments[0] === 'forge') {
        const result = await resolveForge(apiBase, segments, path)
        if (result) return result
        return { ...STATIC_ROUTES['/forge'], image: FORGE_IMAGE, url: `${SITE_URL}${path}` }
    }

    if (segments[0] === 'vault') {
        const result = await resolveVault(apiBase, segments, path)
        if (result) return result
        return { ...STATIC_ROUTES['/vault'], image: VAULT_IMAGE, url: `${SITE_URL}${path}` }
    }

    if (segments[0] === 'org' && segments[1]) {
        return resolveOrg(apiBase, segments[1], path)
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

    const imageAlt = tags.title.replace(` | ${SITE_NAME}`, '')

    const replacements = [
        [/(<meta property="og:title" content=")[^"]*"/, `$1${escapeAttr(tags.title)}"`],
        [/(<meta property="og:description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
        [/(<meta property="og:url" content=")[^"]*"/, `$1${escapeAttr(tags.url)}"`],
        [/(<meta property="og:image" content=")[^"]*"/, `$1${escapeAttr(tags.image)}"`],
        ...(tags.imageWidth ? [[/(<meta property="og:image:width" content=")[^"]*"/, `$1${tags.imageWidth}"`]] : []),
        ...(tags.imageHeight ? [[/(<meta property="og:image:height" content=")[^"]*"/, `$1${tags.imageHeight}"`]] : []),
        [/(<meta property="og:image:alt" content=")[^"]*"/, `$1${escapeAttr(imageAlt)}"`],
        [/(<meta name="description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
        [/(<meta name="twitter:title" content=")[^"]*"/, `$1${escapeAttr(tags.title)}"`],
        [/(<meta name="twitter:description" content=")[^"]*"/, `$1${escapeAttr(tags.description)}"`],
        [/(<meta name="twitter:image" content=")[^"]*"/, `$1${escapeAttr(tags.image)}"`],
        [/(<meta name="twitter:image:alt" content=")[^"]*"/, `$1${escapeAttr(imageAlt)}"`],
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

    // Inject JSON-LD structured data (breadcrumbs, SportsEvent, ProfilePage, etc.)
    if (tags.jsonLd?.length) {
        const scripts = tags.jsonLd
            .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
            .join('\n    ')
        html = html.replace('</head>', `    ${scripts}\n  </head>`)
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

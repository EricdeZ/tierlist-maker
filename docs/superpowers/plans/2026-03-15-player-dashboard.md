# Player Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the marketing homepage with a personalized player dashboard for logged-in users, surfacing actionable items and status across all game systems.

**Architecture:** Lazy-loaded `PlayerDashboard` at `/` for authed users (Homepage stays for guests). Orchestrator fetches all data in parallel via `Promise.allSettled()`, passes to widget components as props. Leverages existing `PassionContext` for Passion/Cores data. One new backend endpoint (`matches?action=my-upcoming`) for upcoming team matches.

**Tech Stack:** React 19, Tailwind CSS 4, existing service layer (`database.js`), Cloudflare Pages Functions, neon() tagged templates.

**Spec:** `docs/superpowers/specs/2026-03-15-player-dashboard-design.md`

---

## File Structure

```
New files:
  src/pages/dashboard/PlayerDashboard.jsx    — orchestrator: data loading + grid layout
  src/pages/dashboard/ActionBar.jsx          — top strip of pending/claimable items
  src/pages/dashboard/UpcomingMatches.jsx    — large widget: next 3 scheduled matches
  src/pages/dashboard/RecentResults.jsx      — large widget: last 5 game results
  src/pages/dashboard/PassionStatus.jsx      — medium widget: rank, balance, streak, claim
  src/pages/dashboard/VaultOverview.jsx      — medium widget: collection, S5, gifts/trades
  src/pages/dashboard/ForgePortfolio.jsx     — medium widget: portfolio value, top holdings
  src/pages/dashboard/ChallengesProgress.jsx — medium widget: closest challenges, claimable
  src/pages/dashboard/CoresClaim.jsx         — small widget: Cores balance + claim
  src/pages/dashboard/TeamWidget.jsx         — small widget: community team + invites
  src/pages/dashboard/ScrimWidget.jsx        — small widget: next scrim + incoming
  src/pages/dashboard/PromoCard.jsx          — reusable empty-state CTA
  src/pages/dashboard/DashboardWidget.jsx    — shared card wrapper (border, hover, sizing)

Modified files:
  src/App.jsx:138                            — conditional route: Dashboard vs Homepage
  src/services/database.js:139-159           — add matchService.getMyUpcoming()
  functions/api/matches.js                   — add my-upcoming action handler
```

---

## Chunk 1: Backend — my-upcoming Endpoint

### Task 1: Add `my-upcoming` action to matches API

**Files:**
- Modify: `functions/api/matches.js`

The current `matches.js` handler only supports `GET` with a `seasonId` param. We need to add an `action` query param check before the existing seasonId logic, handling `my-upcoming` as a new branch.

- [ ] **Step 1: Add the my-upcoming handler to matches.js**

Insert an action check at the top of the try block (before the existing `seasonId` check at line 11). Import `requireAuth` from auth.js.

```javascript
// At top of file, add import:
import { requireAuth } from '../lib/auth.js'

// Inside handler, at top of try block (before line 11):
const { seasonId, limit, action } = event.queryStringParameters || {}

if (event.httpMethod === 'GET' && action === 'my-upcoming') {
    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers: getHeaders(event), body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    if (!user.linked_player_id) {
        return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify({ matches: [] }) }
    }

    // Find teams the player is currently on (across all active seasons)
    const teamIds = await sql`
        SELECT DISTINCT lp.team_id
        FROM league_players lp
        JOIN seasons s ON lp.season_id = s.id
        WHERE lp.player_id = ${user.linked_player_id}
          AND s.is_active = true
          AND lp.team_id IS NOT NULL
    `

    if (teamIds.length === 0) {
        return { statusCode: 200, headers: getHeaders(event), body: JSON.stringify({ matches: [] }) }
    }

    const ids = teamIds.map(r => r.team_id)
    const matches = await sql`
        SELECT
            sm.id as scheduled_match_id,
            sm.scheduled_date as scheduled_time,
            sm.best_of,
            sm.week,
            t1.id as team1_id, t1.name as team1_name, t1.logo_url as team1_logo,
            t2.id as team2_id, t2.name as team2_name, t2.logo_url as team2_logo,
            CASE WHEN t1.id = ANY(${ids}) THEN t1.id ELSE t2.id END as user_team_id,
            d.name as division_name, d.slug as division_slug,
            l.name as league_name, l.slug as league_slug,
            ss.name as stage_name
        FROM scheduled_matches sm
        JOIN teams t1 ON sm.team1_id = t1.id
        JOIN teams t2 ON sm.team2_id = t2.id
        JOIN seasons s ON sm.season_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN leagues l ON d.league_id = l.id
        LEFT JOIN season_stages ss ON sm.stage_id = ss.id
        WHERE sm.status = 'scheduled'
          AND sm.scheduled_date > NOW()
          AND (sm.team1_id = ANY(${ids}) OR sm.team2_id = ANY(${ids}))
        ORDER BY sm.scheduled_date ASC
        LIMIT 3
    `

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({ matches }),
    }
}
```

Note: The existing `const { seasonId, limit } = ...` on line 8 must be updated to also destructure `action`.

- [ ] **Step 2: Verify the endpoint works manually**

Start the dev server and test with curl or browser:
```bash
npm run dev:api
# In another terminal:
curl -H "Authorization: Bearer <your-token>" "http://localhost:8788/api/matches?action=my-upcoming"
```

Expected: `{ "matches": [...] }` with 0-3 upcoming scheduled matches, or `{ "matches": [] }` if no linked player/teams.

- [ ] **Step 3: Commit**

```bash
git add functions/api/matches.js
git commit -m "feat(api): add my-upcoming action to matches endpoint for dashboard"
```

### Task 2: Add `matchService.getMyUpcoming()` to frontend service layer

**Files:**
- Modify: `src/services/database.js:139-159`

- [ ] **Step 1: Add the service method**

Add `getMyUpcoming` to the `matchService` object (after `getById` at line 158):

```javascript
    async getMyUpcoming() {
        return apiCall('matches', { action: 'my-upcoming' })
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(service): add matchService.getMyUpcoming for dashboard"
```

---

## Chunk 2: Shared Components — DashboardWidget + PromoCard

### Task 3: Create DashboardWidget wrapper component

**Files:**
- Create: `src/pages/dashboard/DashboardWidget.jsx`

A shared card wrapper that handles border, background, hover effect, and size variants. All widgets use this as their outer container.

- [ ] **Step 1: Create the component**

```jsx
import { Link } from 'react-router-dom'

const sizeClasses = {
    large: 'col-span-1 md:col-span-2',
    medium: 'col-span-1',
    small: 'col-span-1',
}

// Tailwind CSS 4 requires complete class names (no dynamic interpolation)
const accentStyles = {
    white:   { border: 'border-white/10 hover:border-white/20', icon: 'text-white' },
    blue:    { border: 'border-blue-500/20 hover:border-blue-500/40', icon: 'text-blue-400' },
    emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', icon: 'text-emerald-400' },
    amber:   { border: 'border-amber-500/20 hover:border-amber-500/40', icon: 'text-amber-400' },
    violet:  { border: 'border-violet-500/20 hover:border-violet-500/40', icon: 'text-violet-400' },
    cyan:    { border: 'border-cyan-500/20 hover:border-cyan-500/40', icon: 'text-cyan-400' },
    teal:    { border: 'border-teal-500/20 hover:border-teal-500/40', icon: 'text-teal-400' },
    orange:  { border: 'border-orange-500/20 hover:border-orange-500/40', icon: 'text-orange-400' },
}

export default function DashboardWidget({ title, icon, linkTo, size = 'medium', accent = 'white', children, className = '' }) {
    const styles = accentStyles[accent] || accentStyles.white

    return (
        <div className={`relative overflow-hidden rounded-xl border ${styles.border} bg-gradient-to-b from-white/5 to-transparent p-4 sm:p-5 transition-colors ${sizeClasses[size]} ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-(--color-text-secondary)">{title}</h3>
                </div>
                {linkTo && (
                    <Link to={linkTo} className="text-xs text-(--color-text-secondary) hover:text-(--color-text) transition-colors">
                        View all &rarr;
                    </Link>
                )}
            </div>
            {children}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/DashboardWidget.jsx
git commit -m "feat(dashboard): add DashboardWidget card wrapper component"
```

### Task 4: Create PromoCard empty-state component

**Files:**
- Create: `src/pages/dashboard/PromoCard.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Link } from 'react-router-dom'

export default function PromoCard({ title, description, ctaText, ctaLink, icon }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-4 px-3">
            {icon && <div className="text-3xl mb-2 opacity-60">{icon}</div>}
            <p className="font-heading font-bold text-sm mb-1">{title}</p>
            <p className="text-xs text-(--color-text-secondary) mb-3">{description}</p>
            <Link
                to={ctaLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent)/10 text-(--color-accent) text-xs font-semibold hover:bg-(--color-accent)/20 transition-colors"
            >
                {ctaText}
            </Link>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/PromoCard.jsx
git commit -m "feat(dashboard): add PromoCard empty-state CTA component"
```

---

## Chunk 3: Action Bar

### Task 5: Create ActionBar component

**Files:**
- Create: `src/pages/dashboard/ActionBar.jsx`

Displays icon badges for pending/claimable items. Consumes Passion/Cores state from props (sourced from PassionContext by orchestrator). Other counts passed as props from API responses.

- [ ] **Step 1: Create the component**

```jsx
import { Link } from 'react-router-dom'
import { Gift, Repeat2, Users, Swords, Flame, Trophy, Coins, BarChart3 } from 'lucide-react'

function ActionItem({ icon, count, label, to }) {
    if (!count) return null
    return (
        <Link
            to={to}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
            <span className="text-(--color-accent)">{icon}</span>
            <span className="text-sm font-semibold">{count}</span>
            <span className="text-xs text-(--color-text-secondary) hidden sm:inline">{label}</span>
        </Link>
    )
}

export default function ActionBar({
    canClaimPassion,
    canClaimCores,
    claimableChallenges,
    incomeCollectible,
    pendingGifts,
    pendingTrades,
    pendingTeamInvites,
    incomingScrimRequests,
}) {
    const hasAny = canClaimPassion || canClaimCores || claimableChallenges > 0 ||
        incomeCollectible || pendingGifts > 0 || pendingTrades > 0 ||
        pendingTeamInvites > 0 || incomingScrimRequests > 0

    if (!hasAny) {
        return (
            <div className="col-span-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-(--color-text-secondary)">
                You're all caught up!
            </div>
        )
    }

    return (
        <div className="col-span-full flex flex-wrap gap-2">
            <ActionItem icon={<Flame size={16} />} count={canClaimPassion ? 1 : 0} label="Claim Passion" to="/leaderboard" />
            <ActionItem icon={<Coins size={16} />} count={canClaimCores ? 1 : 0} label="Claim Cores" to="/vault" />
            <ActionItem icon={<Trophy size={16} />} count={claimableChallenges} label="Challenges" to="/challenges" />
            <ActionItem icon={<BarChart3 size={16} />} count={incomeCollectible ? 1 : 0} label="Collect Income" to="/vault" />
            <ActionItem icon={<Gift size={16} />} count={pendingGifts} label="Gifts" to="/vault" />
            <ActionItem icon={<Repeat2 size={16} />} count={pendingTrades} label="Trades" to="/vault" />
            <ActionItem icon={<Users size={16} />} count={pendingTeamInvites} label="Team Invites" to="/scrims" />
            <ActionItem icon={<Swords size={16} />} count={incomingScrimRequests} label="Scrim Requests" to="/scrims" />
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/ActionBar.jsx
git commit -m "feat(dashboard): add ActionBar with pending item badges"
```

---

## Chunk 4: Large Widgets — UpcomingMatches + RecentResults

### Task 6: Create UpcomingMatches widget

**Files:**
- Create: `src/pages/dashboard/UpcomingMatches.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Link } from 'react-router-dom'
import { Calendar, Clock } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

function formatCountdown(dateStr) {
    const diff = new Date(dateStr) - new Date()
    if (diff < 0) return 'Starting soon'
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${mins}m`
}

function MatchRow({ match, isNext }) {
    const opponent = match.user_team_id === match.team1_id
        ? { name: match.team2_name, logo: match.team2_logo }
        : { name: match.team1_name, logo: match.team1_logo }

    return (
        <Link
            to={`/${match.league_slug}/${match.division_slug}/matches`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
            {opponent.logo ? (
                <img src={opponent.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                    {opponent.name?.charAt(0)}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">vs {opponent.name}</p>
                <p className="text-xs text-(--color-text-secondary)">
                    {match.division_name}{match.stage_name ? ` · ${match.stage_name}` : ''}
                </p>
            </div>
            <div className="text-right shrink-0">
                {isNext ? (
                    <span className="text-xs font-bold text-(--color-accent)">{formatCountdown(match.scheduled_time)}</span>
                ) : (
                    <span className="text-xs text-(--color-text-secondary)">
                        {new Date(match.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>
        </Link>
    )
}

export default function UpcomingMatches({ matches, hasTeam }) {
    if (!hasTeam) {
        return (
            <DashboardWidget title="Upcoming Matches" icon={<Calendar size={16} />} size="large">
                <PromoCard
                    title="Join a Team"
                    description="Compete in scheduled league matches"
                    ctaText="Browse Leagues"
                    ctaLink="/leagues"
                    icon={<Calendar size={28} />}
                />
            </DashboardWidget>
        )
    }

    return (
        <DashboardWidget title="Upcoming Matches" icon={<Calendar size={16} />} size="large" accent="blue">
            {matches.length === 0 ? (
                <p className="text-sm text-(--color-text-secondary) py-4 text-center">No upcoming matches scheduled</p>
            ) : (
                <div className="space-y-1">
                    {matches.map((m, i) => (
                        <MatchRow key={m.scheduled_match_id} match={m} isNext={i === 0} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/UpcomingMatches.jsx
git commit -m "feat(dashboard): add UpcomingMatches widget"
```

### Task 7: Create RecentResults widget

**Files:**
- Create: `src/pages/dashboard/RecentResults.jsx`

Uses game history from the player-profile endpoint. Each row shows W/L, opponent, KDA, god icon, date.

- [ ] **Step 1: Create the component**

```jsx
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

function ResultRow({ game }) {
    // Derive win/loss and opponent from raw API fields
    const won = game.winner_team_id === game.player_team_id
    const opponentName = game.team_side === 1 ? game.team2_name : game.team1_name
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {won ? 'W' : 'L'}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm truncate">vs {opponentName || 'Unknown'}</p>
            </div>
            <div className="text-xs text-(--color-text-secondary) shrink-0">
                {game.kills}/{game.deaths}/{game.assists}
            </div>
            <div className="text-xs text-(--color-text-secondary) shrink-0 hidden sm:block">
                {new Date(game.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
        </div>
    )
}

export default function RecentResults({ games, linkedPlayer }) {
    if (!linkedPlayer) {
        return (
            <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large">
                <PromoCard
                    title="Link Your Profile"
                    description="See your match history and stats"
                    ctaText="Claim Profile"
                    ctaLink="/players"
                    icon={<Trophy size={28} />}
                />
            </DashboardWidget>
        )
    }

    const profileLink = `/profile/${linkedPlayer.slug}`

    return (
        <DashboardWidget title="Recent Results" icon={<Trophy size={16} />} size="large" linkTo={profileLink} accent="emerald">
            {(!games || games.length === 0) ? (
                <PromoCard
                    title="No Games Yet"
                    description="Browse active leagues and start competing"
                    ctaText="Browse Leagues"
                    ctaLink="/leagues"
                    icon={<Trophy size={28} />}
                />
            ) : (
                <div className="space-y-1">
                    {games.slice(0, 5).map((g, i) => (
                        <ResultRow key={i} game={g} />
                    ))}
                </div>
            )}
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/RecentResults.jsx
git commit -m "feat(dashboard): add RecentResults widget"
```

---

## Chunk 5: Medium Widgets — Passion, Vault, Forge, Challenges

### Task 8: Create PassionStatus widget

**Files:**
- Create: `src/pages/dashboard/PassionStatus.jsx`

Consumes Passion data from PassionContext (passed as props). Shows rank, balance, streak, progress bar, inline claim button.

- [ ] **Step 1: Create the component**

```jsx
import { Flame } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function PassionStatus({ balance, rank, nextRank, totalEarned, currentStreak, canClaimDaily, onClaimDaily }) {
    const progressPct = nextRank
        ? Math.min(100, ((totalEarned - (rank?.threshold || 0)) / ((nextRank?.threshold || 1) - (rank?.threshold || 0))) * 100)
        : 100

    return (
        <DashboardWidget title="Passion" icon={<Flame size={16} />} linkTo="/leaderboard" accent="amber" className="md:row-span-2">
            <div className="flex flex-col gap-3">
                {/* Rank badge */}
                <div className="text-center">
                    {rank?.image && <img src={rank.image} alt={rank.name} className="w-16 h-16 mx-auto mb-1" />}
                    <p className="font-heading font-bold text-sm">{rank?.name || 'Unranked'}</p>
                </div>

                {/* Balance */}
                <div className="text-center">
                    <p className="text-2xl font-bold">{(balance || 0).toLocaleString()}</p>
                    <p className="text-xs text-(--color-text-secondary)">Passion</p>
                </div>

                {/* Streak */}
                {currentStreak > 0 && (
                    <div className="flex items-center justify-center gap-1.5">
                        <Flame size={14} className="text-orange-400" />
                        <span className="text-sm font-semibold">{currentStreak} day streak</span>
                    </div>
                )}

                {/* Progress bar */}
                {nextRank && (
                    <div>
                        <div className="flex justify-between text-xs text-(--color-text-secondary) mb-1">
                            <span>{rank?.name}</span>
                            <span>{nextRank.name}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                )}

                {/* Daily claim */}
                {canClaimDaily && (
                    <button
                        onClick={onClaimDaily}
                        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                    >
                        Claim Daily Passion
                    </button>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/PassionStatus.jsx
git commit -m "feat(dashboard): add PassionStatus widget"
```

### Task 9: Create VaultOverview widget

**Files:**
- Create: `src/pages/dashboard/VaultOverview.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Layers } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function VaultOverview({ vaultData, startingFive, pendingGifts, pendingTrades, error }) {
    if (error || !vaultData) {
        return (
            <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
                <PromoCard
                    title="Open Your First Pack"
                    description="Collect player cards, build your Starting Five"
                    ctaText="Enter the Vault"
                    ctaLink="/vault"
                    icon={<Layers size={28} />}
                />
            </DashboardWidget>
        )
    }

    const cardCount = vaultData.totalCards || 0
    const uniqueCount = vaultData.uniqueCards || 0
    const incomeReady = startingFive?.incomeCollectible
    const pendingCount = (pendingGifts || 0) + (pendingTrades || 0)

    return (
        <DashboardWidget title="The Vault" icon={<Layers size={16} />} linkTo="/vault" accent="violet">
            <div className="space-y-3">
                {/* Card counts */}
                <div className="flex gap-4">
                    <div>
                        <p className="text-xl font-bold">{cardCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Cards</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold">{uniqueCount}</p>
                        <p className="text-xs text-(--color-text-secondary)">Unique</p>
                    </div>
                </div>

                {/* Starting Five preview */}
                {startingFive?.slots && (
                    <div className="flex gap-1">
                        {['solo', 'jungle', 'mid', 'support', 'carry'].map(role => {
                            const slot = startingFive.slots.find(s => s.role === role)
                            return (
                                <div key={role} className="w-10 h-10 rounded bg-white/10 overflow-hidden flex items-center justify-center text-[10px] text-(--color-text-secondary) uppercase">
                                    {slot?.card?.image_url ? (
                                        <img src={slot.card.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : role[0]}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pending items */}
                {pendingCount > 0 && (
                    <p className="text-xs text-violet-400 font-semibold">{pendingCount} pending {pendingCount === 1 ? 'item' : 'items'}</p>
                )}

                {/* Income */}
                {incomeReady && (
                    <p className="text-xs text-emerald-400 font-semibold">Income ready to collect!</p>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/VaultOverview.jsx
git commit -m "feat(dashboard): add VaultOverview widget"
```

### Task 10: Create ForgePortfolio widget

**Files:**
- Create: `src/pages/dashboard/ForgePortfolio.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { TrendingUp } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function ForgePortfolio({ portfolio, marketClosed, forgeLeagueSlug, error }) {
    if (marketClosed) {
        return (
            <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} accent="cyan">
                <p className="text-sm text-(--color-text-secondary) py-4 text-center">Markets are currently closed</p>
            </DashboardWidget>
        )
    }

    if (error || !portfolio) {
        return (
            <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} linkTo="/forge" accent="cyan">
                <PromoCard
                    title="Invest in Players"
                    description="Build a portfolio and compete on the leaderboard"
                    ctaText="Enter the Forge"
                    ctaLink="/forge"
                    icon={<TrendingUp size={28} />}
                />
            </DashboardWidget>
        )
    }

    const linkTo = forgeLeagueSlug ? `/forge/${forgeLeagueSlug}` : '/forge'

    return (
        <DashboardWidget title="Fantasy Forge" icon={<TrendingUp size={16} />} linkTo={linkTo} accent="cyan">
            <div className="space-y-3">
                {/* Portfolio value */}
                <div>
                    <p className="text-xl font-bold">{(portfolio.totalValue || 0).toLocaleString()} Sparks</p>
                    <p className="text-xs text-(--color-text-secondary)">Portfolio Value</p>
                </div>

                {/* Top holdings */}
                {portfolio.holdings?.length > 0 && (
                    <div className="space-y-1.5">
                        {portfolio.holdings.slice(0, 3).map(h => (
                            <div key={h.sparkId} className="flex justify-between text-sm">
                                <span className="truncate">{h.playerName}</span>
                                <span className="text-(--color-text-secondary) shrink-0 ml-2">{h.currentPrice}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/ForgePortfolio.jsx
git commit -m "feat(dashboard): add ForgePortfolio widget"
```

### Task 11: Create ChallengesProgress widget

**Files:**
- Create: `src/pages/dashboard/ChallengesProgress.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Target } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function ChallengesProgress({ challenges, claimableCount }) {
    // Sort by completion percentage descending, take closest 3
    const sorted = (challenges || [])
        .filter(c => c.current_value < c.target_value)
        .map(c => ({ ...c, pct: (c.current_value / c.target_value) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3)

    return (
        <DashboardWidget title="Challenges" icon={<Target size={16} />} linkTo="/challenges" accent="emerald">
            <div className="space-y-3">
                {claimableCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10">
                        <span className="text-xs font-bold text-emerald-400">{claimableCount} reward{claimableCount !== 1 ? 's' : ''} to claim!</span>
                    </div>
                )}

                {sorted.length === 0 && claimableCount === 0 && (
                    <p className="text-sm text-(--color-text-secondary) py-2 text-center">Complete challenges to earn Passion</p>
                )}

                {sorted.map(c => (
                    <div key={c.id}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="truncate pr-2">{c.title}</span>
                            <span className="text-(--color-text-secondary) shrink-0">{c.current_value}/{c.target_value}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/ChallengesProgress.jsx
git commit -m "feat(dashboard): add ChallengesProgress widget"
```

---

## Chunk 6: Small Widgets — Cores, Team, Scrim

### Task 12: Create CoresClaim widget

**Files:**
- Create: `src/pages/dashboard/CoresClaim.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Coins } from 'lucide-react'
import DashboardWidget from './DashboardWidget'

export default function CoresClaim({ balance, currentStreak, canClaimDaily, onClaimDaily }) {
    return (
        <DashboardWidget title="Cores" icon={<Coins size={16} />} accent="teal">
            <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold">{(balance || 0).toLocaleString()}</p>
                    {currentStreak > 0 && (
                        <span className="text-xs text-(--color-text-secondary)">{currentStreak}d streak</span>
                    )}
                </div>

                {canClaimDaily && (
                    <button
                        onClick={onClaimDaily}
                        className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                    >
                        Claim Daily Cores
                    </button>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/CoresClaim.jsx
git commit -m "feat(dashboard): add CoresClaim widget"
```

### Task 13: Create TeamWidget

**Files:**
- Create: `src/pages/dashboard/TeamWidget.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Users } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function TeamWidget({ teams, pendingCount }) {
    if (!teams || teams.length === 0) {
        return (
            <DashboardWidget title="My Team" icon={<Users size={16} />} accent="blue">
                <PromoCard
                    title="Find a Team"
                    description="Join or create a community team"
                    ctaText="Browse Teams"
                    ctaLink="/leagues"
                    icon={<Users size={28} />}
                />
            </DashboardWidget>
        )
    }

    const team = teams[0]

    return (
        <DashboardWidget title="My Team" icon={<Users size={16} />} accent="blue" linkTo="/scrims">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                            {team.name?.charAt(0)}
                        </div>
                    )}
                    <p className="text-sm font-semibold truncate">{team.name}</p>
                </div>

                {/* Roster avatars */}
                {team.members?.length > 0 && (
                    <div className="flex -space-x-1.5">
                        {team.members.slice(0, 6).map(m => (
                            <div key={m.user_id} className="w-6 h-6 rounded-full bg-white/10 border border-(--color-primary) overflow-hidden" title={m.username}>
                                {m.avatar ? (
                                    <img src={`https://cdn.discordapp.com/avatars/${m.discord_id}/${m.avatar}.webp?size=32`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px]">{m.username?.[0]}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {pendingCount > 0 && (
                    <p className="text-xs text-blue-400 font-semibold">{pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}</p>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/TeamWidget.jsx
git commit -m "feat(dashboard): add TeamWidget"
```

### Task 14: Create ScrimWidget

**Files:**
- Create: `src/pages/dashboard/ScrimWidget.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Swords } from 'lucide-react'
import DashboardWidget from './DashboardWidget'
import PromoCard from './PromoCard'

export default function ScrimWidget({ scrims, incomingCount, isCaptain }) {
    // Hide entirely if not a captain
    if (!isCaptain) return null

    if (!scrims || scrims.length === 0) {
        return (
            <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
                <PromoCard
                    title="Challenge Teams"
                    description="Post or accept scrim requests"
                    ctaText="Open Scrim Planner"
                    ctaLink="/scrims"
                    icon={<Swords size={28} />}
                />
            </DashboardWidget>
        )
    }

    const next = scrims[0]

    return (
        <DashboardWidget title="Scrims" icon={<Swords size={16} />} linkTo="/scrims" accent="orange">
            <div className="space-y-2">
                <div>
                    <p className="text-sm font-semibold truncate">vs {next.opponent_name || 'TBD'}</p>
                    {next.scheduled_time && (
                        <p className="text-xs text-(--color-text-secondary)">
                            {new Date(next.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                    )}
                </div>

                {incomingCount > 0 && (
                    <p className="text-xs text-orange-400 font-semibold">{incomingCount} incoming request{incomingCount !== 1 ? 's' : ''}</p>
                )}
            </div>
        </DashboardWidget>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/ScrimWidget.jsx
git commit -m "feat(dashboard): add ScrimWidget"
```

---

## Chunk 7: Orchestrator + Route Integration

### Task 15: Create PlayerDashboard orchestrator

**Files:**
- Create: `src/pages/dashboard/PlayerDashboard.jsx`

This is the main component — fetches all data in parallel, manages loading/error states, renders the grid with all widgets.

- [ ] **Step 1: Create the orchestrator**

```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import {
    matchService, profileService, vaultService, forgeService,
    challengeService, communityTeamService, scrimService, tradingService,
} from '../../services/database'

import ActionBar from './ActionBar'
import UpcomingMatches from './UpcomingMatches'
import RecentResults from './RecentResults'
import PassionStatus from './PassionStatus'
import VaultOverview from './VaultOverview'
import ForgePortfolio from './ForgePortfolio'
import ChallengesProgress from './ChallengesProgress'
import CoresClaim from './CoresClaim'
import TeamWidget from './TeamWidget'
import ScrimWidget from './ScrimWidget'

export default function PlayerDashboard() {
    const { user, linkedPlayer } = useAuth()
    const passion = usePassion()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const results = await Promise.allSettled([
                matchService.getMyUpcoming(),                           // 0
                linkedPlayer?.slug
                    ? profileService.getPlayerProfile(linkedPlayer.slug) // 1
                    : Promise.resolve(null),
                vaultService.loadStartingFive(),                        // 2
                vaultService.loadGifts(),                               // 3
                tradingService.pending(),                               // 4
                communityTeamService.getPendingCount(),                  // 5
                scrimService.getIncoming(),                             // 6
                forgeService.getMarketStatuses(),                       // 7
                challengeService.getAll(),                              // 8
                communityTeamService.getMyTeams(),                      // 9
                scrimService.getMyScrims(),                             // 10
                scrimService.getCaptainTeams(),                         // 11
                vaultService.load(),                                    // 12
            ])

            const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null

            // Resolve Forge portfolio: find active market, then fetch portfolio
            let forgePortfolio = null
            let forgeLeagueSlug = null
            let marketClosed = true
            let forgeError = false
            const marketStatuses = val(7)
            if (marketStatuses?.seasons) {
                const activeSeason = marketStatuses.seasons.find(s => s.status === 'open')
                if (activeSeason) {
                    marketClosed = false
                    forgeLeagueSlug = activeSeason.leagueSlug
                    try {
                        forgePortfolio = await forgeService.getPortfolio(activeSeason.seasonId)
                    } catch (e) {
                        console.error('Forge portfolio load failed:', e)
                        forgeError = true
                    }
                }
            }

            // Extract challenge data
            const challengeData = val(8)
            const challenges = challengeData?.challenges
                ? Object.values(challengeData.challenges).flat()
                : []

            setData({
                upcomingMatches: val(0)?.matches || [],
                profile: val(1),
                startingFive: val(2),
                gifts: val(3),
                pendingTrades: val(4)?.trades || [],
                teamPendingCount: val(5)?.count || 0,
                incomingScrims: val(6)?.scrims || [],
                forgePortfolio,
                forgeLeagueSlug,
                forgeError,
                marketClosed,
                challenges,
                claimableChallenges: challengeData?.claimableCount || 0,
                myTeams: val(9)?.teams || [],
                myScrims: val(10)?.scrims || [],
                captainTeams: val(11)?.teams || [],
                vaultData: val(12),
            })
            setLoading(false)
        }

        load()
    }, [linkedPlayer?.slug])

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`rounded-xl border border-white/10 bg-white/5 animate-pulse ${i < 2 ? 'md:col-span-2 h-48' : 'h-40'}`} />
                    ))}
                </div>
            </div>
        )
    }

    const hasTeam = data.myTeams.length > 0 || data.upcomingMatches.length > 0
    const isCaptain = data.captainTeams.length > 0
    const pendingGiftCount = data.gifts?.gifts?.filter(g => !g.opened)?.length || 0

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Greeting */}
            <h1 className="font-heading text-2xl font-bold mb-5">
                Welcome back{user?.discord_username ? `, ${user.discord_username}` : ''}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Action Bar */}
                <ActionBar
                    canClaimPassion={passion.canClaimDaily}
                    canClaimCores={passion.ember?.canClaimDaily}
                    claimableChallenges={data.claimableChallenges}
                    incomeCollectible={data.startingFive?.incomeCollectible}
                    pendingGifts={pendingGiftCount}
                    pendingTrades={data.pendingTrades.length}
                    pendingTeamInvites={data.teamPendingCount}
                    incomingScrimRequests={data.incomingScrims.length}
                />

                {/* Large widgets */}
                <UpcomingMatches matches={data.upcomingMatches} hasTeam={hasTeam} />
                {/* Passion spans 2 rows on desktop */}
                <PassionStatus
                    balance={passion.balance}
                    rank={passion.rank}
                    nextRank={passion.nextRank}
                    totalEarned={passion.totalEarned}
                    currentStreak={passion.currentStreak}
                    canClaimDaily={passion.canClaimDaily}
                    onClaimDaily={passion.claimDaily}
                />
                <RecentResults games={data.profile?.gameHistory} linkedPlayer={linkedPlayer} />

                {/* Medium widgets */}
                <VaultOverview
                    vaultData={data.vaultData}
                    startingFive={data.startingFive}
                    pendingGifts={pendingGiftCount}
                    pendingTrades={data.pendingTrades.length}
                />
                <ForgePortfolio
                    portfolio={data.forgePortfolio}
                    marketClosed={data.marketClosed}
                    forgeLeagueSlug={data.forgeLeagueSlug}
                    error={data.forgeError}
                />

                <CoresClaim
                    balance={passion.ember?.balance}
                    currentStreak={passion.ember?.currentStreak}
                    canClaimDaily={passion.ember?.canClaimDaily}
                    onClaimDaily={passion.claimEmberDaily}
                />

                {/* Bottom row */}
                <ChallengesProgress
                    challenges={data.challenges}
                    claimableCount={data.claimableChallenges}
                />
                <TeamWidget teams={data.myTeams} pendingCount={data.teamPendingCount} />
                <ScrimWidget
                    scrims={data.myScrims}
                    incomingCount={data.incomingScrims.length}
                    isCaptain={isCaptain}
                />
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dashboard/PlayerDashboard.jsx
git commit -m "feat(dashboard): add PlayerDashboard orchestrator with parallel data loading"
```

### Task 16: Wire up conditional route in App.jsx

**Files:**
- Modify: `src/App.jsx:2,10,138`

- [ ] **Step 1: Add lazy import for PlayerDashboard**

At the top of App.jsx, after the existing lazy imports (around line 113), add:

```javascript
const PlayerDashboard = lazy(() => import('./pages/dashboard/PlayerDashboard'))
```

- [ ] **Step 2: Create a conditional home route component**

Add a small inline component before the `App` function (around line 114):

```javascript
function HomeRoute() {
    const { user, loading } = useAuth()
    if (loading) return null
    if (user) return <Suspense fallback={null}><PlayerDashboard /></Suspense>
    return <Homepage />
}
```

This requires importing `useAuth` in App.jsx. Check if it's already imported — if not, add:

```javascript
import { useAuth } from './context/AuthContext'
```

- [ ] **Step 3: Replace the index route**

Change line 138 from:

```jsx
<Route index element={<Homepage />} />
```

to:

```jsx
<Route index element={<HomeRoute />} />
```

- [ ] **Step 4: Verify locally**

```bash
npm start
```

1. Visit `http://localhost:5173/` logged out — should see existing Homepage
2. Log in — should see the new PlayerDashboard with all widgets loading
3. Check browser console for errors

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: conditionally render PlayerDashboard for logged-in users at /"
```

---

## Chunk 8: Polish + Integration Testing

### Task 17: Adjust grid layout for Passion spanning 2 rows

**Files:**
- Modify: `src/pages/dashboard/DashboardWidget.jsx`
- Modify: `src/pages/dashboard/PlayerDashboard.jsx`

The Passion widget uses `className="md:row-span-2"` (set in Task 8). Verify it spans correctly alongside UpcomingMatches and RecentResults. If the grid auto-placement doesn't work well, switch to explicit `grid-template-areas`.

- [ ] **Step 1: Test the layout in browser at various widths**

Check desktop (1200px+), tablet (768px), and mobile (375px). The expected layout on desktop:
- Row 1: UpcomingMatches (cols 1-2), PassionStatus (col 3, spanning row 1+2)
- Row 2: RecentResults (cols 1-2), PassionStatus continues
- Row 3: VaultOverview (col 1), ForgePortfolio (col 2), CoresClaim (col 3)
- Row 4: Challenges (col 1), Team (col 2), Scrim (col 3)

If auto-placement doesn't achieve this, update `PlayerDashboard.jsx` grid to use explicit `grid-template-areas` or use `order` utilities on widget divs.

- [ ] **Step 2: Fix any layout issues found**

Adjust Tailwind classes as needed. Common fixes:
- Add `lg:col-span-2` to UpcomingMatches/RecentResults wrapper if not picking up from DashboardWidget
- Add explicit ordering with `order-N` if auto-flow places widgets incorrectly

- [ ] **Step 3: Commit if any changes were needed**

```bash
git add src/pages/dashboard/
git commit -m "fix(dashboard): adjust grid layout for proper widget placement"
```

### Task 18: End-to-end smoke test

- [ ] **Step 1: Test with a linked player account**

Log in as a user with:
- A linked player (has match history)
- A community team
- Vault cards
- Forge portfolio

Verify all widgets show real data.

- [ ] **Step 2: Test with a fresh/minimal account**

Log in as a user with no linked player, no teams, no vault cards. Verify:
- PromoCards show for Vault, Forge, Teams
- "Link Your Profile" shows for Recent Results
- "Join a team" shows for Upcoming Matches
- Scrim widget is hidden (not a captain)
- Passion and Challenges still show (everyone has these)

- [ ] **Step 3: Test claim actions**

- Click "Claim Daily Passion" → balance updates, button disappears, ActionBar updates
- Click "Claim Daily Cores" → same behavior
- Verify no console errors after claims

- [ ] **Step 4: Test logged-out experience**

Log out, visit `/` — should see original Homepage unchanged.

- [ ] **Step 5: Final commit**

```bash
git add src/pages/dashboard/ src/App.jsx functions/api/matches.js src/services/database.js
git commit -m "feat(dashboard): complete player home dashboard with all widgets"
```

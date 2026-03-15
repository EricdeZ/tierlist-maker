# Player Home Dashboard — Design Spec

## Overview

Replace the marketing homepage with a personalized player dashboard for logged-in users. Logged-out users continue to see the existing `Homepage.jsx`. The dashboard surfaces actionable items, status across all systems, and promotional CTAs for unused features.

## Route Behavior

- **Logged out** at `/` → existing `Homepage.jsx` (no changes)
- **Logged in** at `/` → new `PlayerDashboard.jsx`

Controlled in `App.jsx` — conditionally render based on auth state from `AuthContext`.

## File Structure

```
src/pages/dashboard/
  PlayerDashboard.jsx    — grid layout + parallel data loading
  ActionBar.jsx          — top strip of pending/claimable items
  UpcomingMatches.jsx    — large widget
  RecentResults.jsx      — large widget
  PassionStatus.jsx      — medium widget
  VaultOverview.jsx      — medium widget
  ForgePortfolio.jsx     — medium widget
  ChallengesProgress.jsx — medium widget
  CoresClaim.jsx         — small widget
  TeamWidget.jsx         — small widget
  ScrimWidget.jsx        — small widget
  PromoCard.jsx          — reusable empty-state CTA component
```

## Data Loading

`PlayerDashboard` fires all API calls in parallel on mount. Each widget receives data as props. Single top-level loading state — no nested spinners per widget.

### API Calls Required

| Widget | Endpoint | Action |
|--------|----------|--------|
| ActionBar | `passion` | `balance` (daily claim status, claimable challenges) |
| ActionBar | `vault` | `starting-five` (income collectible), `gifts` (pending count) |
| ActionBar | `trading` | `pending` (trade invite count) |
| ActionBar | `community-teams` | `pending-count` (invitation count) |
| ActionBar | `scrim` | `incoming` (request count) |
| ActionBar | `ember` | `balance` (daily claim status) |
| UpcomingMatches | New endpoint or existing `matches` | Upcoming scheduled matches for user's teams |
| RecentResults | `stats` or `player-profile` | Recent game history for linked player |
| PassionStatus | `passion` | `balance` (rank, balance, streak, progress) |
| VaultOverview | `vault` | `load` or `collection-owned` + `starting-five` |
| ForgePortfolio | `forge` | `portfolio` (holdings, value, Sparks balance) |
| ChallengesProgress | `challenges` | List with user progress |
| CoresClaim | `ember` | `balance` (Cores balance, claim status, streak) |
| TeamWidget | `community-teams` | `my-teams` (membership, roster) |
| ScrimWidget | `scrim` | `my-scrims` (upcoming scrims) |

Many of these overlap (e.g., Passion balance needed by ActionBar and PassionStatus). Deduplicate at the orchestrator level — fetch once, pass to multiple widgets.

### New API Endpoint Needed

**Upcoming matches for a player's teams** — Currently no single endpoint returns "scheduled matches for teams I'm on." Options:
1. New `dashboard` endpoint that aggregates this server-side
2. New action on existing `matches` endpoint: `?action=my-upcoming`
3. Fetch `community-teams?action=my-teams` then `matches` per team client-side

Recommendation: **Option 2** — add `my-upcoming` action to the matches endpoint. Takes the auth token, looks up user's linked player → team memberships → upcoming scheduled matches. Returns max 3 matches sorted by date.

## Layout

Responsive CSS grid with varied widget sizes.

### Desktop (3-column grid)

```
┌─────────────────────────────────────────────┐
│              Action Bar (full width)         │
├─────────────────────────────────────────────┤
│    Upcoming Matches (2 cols)    │  Passion   │
│                                 │  Status    │
├─────────────────────────────────┤            │
│    Recent Results (2 cols)      │            │
│                                 ├────────────┤
├──────────────┬──────────────────┤   Cores    │
│    Vault     │     Forge        │   Claim    │
│   Overview   │   Portfolio      │            │
├──────────────┼──────────────────┼────────────┤
│  Challenges  │     Team         │   Scrim    │
│  Progress    │    Widget        │   Widget   │
└──────────────┴──────────────────┴────────────┘
```

### Tablet (2-column grid)

Large widgets span full width. Medium widgets are 1 column each. Small widgets stack or go 2-up.

### Mobile (single column)

All widgets stack vertically. Action bar wraps into a scrollable row.

## Widget Specifications

### Action Bar

Horizontal strip at the top of the dashboard (not sticky). Shows icon + count badge for each pending item:

- Daily Passion claim (if unclaimed)
- Daily Cores claim (if unclaimed)
- Claimable challenges (count)
- Starting Five income (if collectible)
- Pending gifts (count)
- Pending trade invites (count)
- Pending team invitations (count)
- Incoming scrim requests (count)

Each item links to its relevant page. Items with nothing pending are **hidden** (not greyed out). If all clear, show "You're all caught up" message.

### Upcoming Matches (Large — 2 cols)

- Next 3 scheduled matches for teams the player is on
- Per match: opponent logo + name, date/time, countdown for nearest match, division name
- Each row links to the match/schedule page
- **Empty state (no team):** PromoCard — "Join a team to compete"
- **Empty state (no matches):** "No upcoming matches scheduled"

### Recent Results (Large — 2 cols)

- Last 5 games played by the linked player
- Per game: W/L badge, opponent, KDA, god icon, date
- Each row links to match detail
- **Empty state (no linked player):** PromoCard — "Link your player profile to see your stats"
- **Empty state (no games):** PromoCard — "Browse active leagues"

### Passion Status (Medium)

- Rank badge + rank name
- Balance display
- Streak count (fire icon + number)
- Progress bar to next rank (current XP / next threshold)
- Inline daily claim button (if unclaimed)
- Links to Passion leaderboard

### Vault Overview (Medium)

- Total cards owned / unique count
- Starting Five preview (5 small card thumbnails or empty slots)
- Pending gifts + trades count (if any)
- Income status: collectible now, or time until next collection
- Links to Vault page
- **Empty state:** PromoCard — "Open your first pack"

### Forge Portfolio (Medium)

- Total portfolio value + change indicator (up/down arrow with delta)
- Sparks balance
- Top 3 holdings: player name + current price
- Links to Forge page
- **Empty state:** PromoCard — "Invest in players"

### Challenges Progress (Medium)

- Claimable count (prominent badge if > 0)
- 2-3 closest-to-completion challenges with progress bars (name + X/Y)
- Links to challenges page
- Always shows (everyone has challenges)

### Cores Claim (Small)

- Cores balance
- Daily claim button (if unclaimed)
- Streak count
- Compact layout — number + button

### Team Widget (Small)

- Team name + logo
- Roster preview (player avatar row)
- Pending invitation count badge
- Links to team page
- **Empty state:** PromoCard — "Find a team" / "Create a team"

### Scrim Widget (Small)

- Next upcoming scrim: opponent + time
- Incoming request count badge
- Links to scrim planner
- **Empty state (captain):** PromoCard — "Challenge other teams"
- **Empty state (not captain):** Hidden entirely

## PromoCard Component

Reusable component for empty states that promote unused features.

Props:
- `title` — feature name
- `description` — one-line pitch
- `ctaText` — button label
- `ctaLink` — route to navigate to
- `icon` or `illustration` — visual element

Styled consistently across all widgets. Subtle background, not aggressive — should feel like a suggestion, not an ad.

## Adaptive Behavior

All widgets always render. Unused features show their PromoCard empty state rather than being hidden. This promotes feature discovery.

Exception: Scrim Widget hides entirely if the user is not a captain on any team (scrims are captain-initiated, so non-captains have no actions).

## No New Dependencies

Uses existing Tailwind CSS grid utilities. No additional libraries needed.

# Tournament Signup System Design

## Overview

Standalone tournament system for smitecomp.com — independent from the existing league/division/season hierarchy. Supports user-facing signup with admin approval, tournament date management, and marketing copy for prizing (HiRez prizing, smitecomp packs, Passion prizing, tournament cards).

## Database Schema

### `tournaments`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar | e.g., "SmiteComp Invitational #1" |
| slug | varchar, unique | URL-safe identifier |
| description | text | Marketing copy (prizing info, tournament cards, etc.) |
| draft_date | date | Captain-only draft day |
| game_dates | jsonb | Array of ISO 8601 date strings, e.g. `["2026-04-05","2026-04-06"]` |
| signups_open | boolean, default false | Admin toggle |
| status | varchar | `'upcoming'` \| `'in_progress'` \| `'completed'` |
| discord_invite_url | varchar | SmiteComp Discord link |
| created_by | FK → users.id | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### `tournament_signups`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| tournament_id | FK → tournaments.id ON DELETE CASCADE | |
| user_id | FK → users.id | |
| player_id | FK → players.id, nullable | Set from user's linked_player_id if name confirmed |
| smite_name | varchar | Confirmed by user |
| tracker_url | varchar, nullable | Required only if user changed pre-filled name |
| applying_as_captain | boolean, default false | |
| available_game_dates | jsonb | Subset of tournament's `game_dates` the user is available for |
| available_draft_date | boolean | Must be true if applying_as_captain |
| status | varchar | `'pending'` \| `'approved'` \| `'rejected'` |
| reviewed_by | FK → users.id, nullable | |
| reviewed_at | timestamptz, nullable | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

**Constraints:**
- Unique: `(tournament_id, user_id)` — one signup per user per tournament
- Check: `applying_as_captain = false OR available_draft_date = true` — captains must be available for draft

## Player Matching Logic

Auto-matching uses **only** the user's `linked_player_id` — no name-based fuzzy matching.

1. User has `linked_player_id` → pre-fill smite name from `players.name`, pre-fill tracker from `players.tracker_url`
2. User confirms name unchanged → `player_id` = `linked_player_id`, tracker inherited
3. User changes name → `player_id` = null, tracker URL field appears (required), admin can link later
4. User has no `linked_player_id` → empty smite name, tracker URL required, `player_id` = null

## API Endpoints

### Public

**`GET /api/tournaments`**
- No params: list all tournaments with `status != 'completed'`
- `?slug=xxx`: fetch single tournament by slug
- No auth required
- CORS: `headers` (wildcard)

**`GET /api/tournament-signup?tournamentId=xxx`**
- Get current user's signup for this tournament (if any)
- Auth required
- CORS: `headers` (wildcard)
- Returns: signup record with status, or null

**`POST /api/tournament-signup`** (action: `signup`)
- Auth required, signups must be open
- CORS: `headers` (wildcard)
- Body: `{ tournamentId, smiteName, trackerUrl?, applyingAsCaptain, availableGameDates, availableDraftDate }`
- Flow:
  1. Check user doesn't already have a signup for this tournament
  2. If user has `linked_player_id` and submitted name matches `players.name`: set `player_id`, inherit tracker
  3. Otherwise: `player_id` = null, require `trackerUrl`
  4. If captain: validate `availableDraftDate = true`
  5. Insert with status = 'pending'

### Admin (permission: `tournament_manage`, called without league scope)

All admin endpoints use `adminHeaders(event)` for CORS. All mutating actions call `logAudit()`.

**`POST /api/tournament-manage`** (action: `create`)
- Body: `{ name, slug, description, draftDate, gameDates, discordInviteUrl }`
- Creates tournament with signups_open = false, status = 'upcoming'

**`POST /api/tournament-manage`** (action: `update`)
- Body: `{ tournamentId, name?, slug?, description?, draftDate?, gameDates?, discordInviteUrl? }`
- Partial update of tournament fields

**`POST /api/tournament-manage`** (action: `toggle-signups`)
- Body: `{ tournamentId }`
- Flips signups_open boolean

**`POST /api/tournament-manage`** (action: `update-status`)
- Body: `{ tournamentId, status }`
- Sets upcoming/in_progress/completed

**`GET /api/tournament-manage?tournamentId=xxx`**
- List all signups for tournament with joined user + player details
- Returns: array of signups with discord_username, smite_name, captain flag, dates, status

**`POST /api/tournament-manage`** (action: `review-signup`)
- Body: `{ signupId, status }` (approved/rejected)
- Sets reviewed_by and reviewed_at

## Pages

### Public: `/tournaments/:slug`

**Layout:** Inside AppLayout (has sidebar, auth context), but NOT inside DivisionLayout.

**Content:**
- Tournament name and description (marketing copy — prizing, tournament cards, HiRez prizes, smitecomp packs, Passion rewards)
- Draft date + game dates displayed clearly
- Discord join requirement with invite link
- Signup form (visible only if logged in + signups_open):
  - Smite name field (pre-filled from linked player if exists)
  - If user changes pre-filled name: tracker URL field appears (required)
  - If no linked player: both smite name and tracker URL shown
  - Game day availability checkboxes (one per date in game_dates)
  - "Apply as captain" toggle
  - If captain toggled on: draft date availability checkbox (required)
  - Submit button
- If already signed up: status badge (pending/approved/rejected)
- If not logged in: prompt to log in via Discord
- If signups closed: "Signups are closed" message

### Admin: `/admin/tournaments`

**Location:** New admin page, accessible from admin sidebar. Route inside AdminLayout.

**Content:**
- Tournament list (create new / select existing)
- Edit form: name, slug, description (textarea), draft date, game dates, discord URL
- Toggle signups open/closed button
- Status selector (upcoming/in_progress/completed)
- Signups table:
  - Columns: Discord username, smite name, captain?, available dates, status
  - Filter tabs: All / Pending / Approved / Rejected
  - Approve/reject action buttons per row
  - Count summaries (total signups, pending, approved captains, approved players)

## Signup Flow (User Perspective)

1. User visits `/tournaments/smitecomp-invitational-1`
2. Sees tournament info, prizing details, dates
3. Logs in via Discord (if not already)
4. System checks if user has `linked_player_id`:
   - **Yes:** Pre-fills smite name + tracker from `players` table
   - **No:** Empty fields
5. User confirms or edits smite name
   - If unchanged and linked: `player_id` set, tracker inherited
   - If changed or no link: tracker URL field shown (required), `player_id` = null
6. Selects available game dates
7. Optionally toggles "Apply as captain" (must check draft date available)
8. Submits → status = pending
9. Admin reviews and approves/rejects from admin panel

## Permission

New permission key: `tournament_manage` — added to existing RBAC system. Called without league scope (`requirePermission(event, 'tournament_manage')` — any role assignment with this key grants access regardless of league scope). Owner/Admin system roles get it by default.

## Files to Create/Modify

### New Files
- `functions/api/tournaments.js` — public GET endpoint
- `functions/api/tournament-signup.js` — user signup GET/POST
- `functions/api/tournament-manage.js` — admin CRUD + signup review
- `src/pages/TournamentSignup.jsx` — public tournament page with signup form
- `src/pages/admin/TournamentManager.jsx` — admin management page

### Modified Files
- `src/App.jsx` — add routes: `/tournaments/:slug` (inside AppLayout), `/admin/tournaments` (inside AdminLayout)
- `src/pages/admin/AdminLayout.jsx` or sidebar config — add Tournaments link
- `src/services/api/` — add tournament API functions (new file or extend existing)
- DB migration script (run manually) — create tables, add `tournament_manage` permission key to Owner/Admin roles

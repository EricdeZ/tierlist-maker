# Tournament Signup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone tournament signup system with public signup page, admin management, and approval workflow — independent from the existing league hierarchy.

**Architecture:** New `tournaments` and `tournament_signups` tables. Three API endpoints: public tournament listing (`tournaments.js`), authenticated signup (`tournament-signup.js`), and admin management (`tournament-manage.js`). Public page at `/tournaments/:slug` with signup form. Admin page at `/admin/tournaments` with CRUD + approval table.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4, React Router 7

**Spec:** `docs/superpowers/specs/2026-03-18-tournament-signup-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/120-tournaments.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 120-tournaments.sql
-- Standalone tournament signup system

CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  draft_date DATE,
  game_dates JSONB DEFAULT '[]'::jsonb,
  signups_open BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  discord_invite_url VARCHAR(512),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournament_signups (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  player_id INTEGER REFERENCES players(id),
  smite_name VARCHAR(255) NOT NULL,
  tracker_url VARCHAR(512),
  applying_as_captain BOOLEAN NOT NULL DEFAULT false,
  available_game_dates JSONB DEFAULT '[]'::jsonb,
  available_draft_date BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id),
  CHECK (applying_as_captain = false OR available_draft_date = true)
);

-- Add tournament_manage permission to Owner and Admin system roles
INSERT INTO role_permissions (role_id, permission_key)
SELECT id, 'tournament_manage' FROM roles WHERE name IN ('Owner', 'Admin');
```

- [ ] **Step 2: Run the migration against dev database**

```bash
psql "$DATABASE_URL" -f database/migrations/120-tournaments.sql
```

Expected: `CREATE TABLE`, `CREATE TABLE`, `INSERT 0 2`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/120-tournaments.sql
git commit -m "feat(tournament): add tournaments and tournament_signups tables"
```

---

## Task 2: Backend — Public Tournaments Endpoint

**Files:**
- Create: `functions/api/tournaments.js`

- [ ] **Step 1: Create the public tournaments endpoint**

```js
import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, getHeaders, headers } from '../lib/db.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { slug } = event.queryStringParameters || {}

            if (slug) {
                const [tournament] = await sql`
                    SELECT id, name, slug, description, draft_date, game_dates,
                           signups_open, status, discord_invite_url, created_at
                    FROM tournaments
                    WHERE slug = ${slug}
                `
                if (!tournament) {
                    return {
                        statusCode: 404,
                        headers: getHeaders(event),
                        body: JSON.stringify({ error: 'Tournament not found' }),
                    }
                }
                return {
                    statusCode: 200,
                    headers: getHeaders(event),
                    body: JSON.stringify(tournament),
                }
            }

            // List all non-completed tournaments
            const tournaments = await sql`
                SELECT id, name, slug, description, draft_date, game_dates,
                       signups_open, status, discord_invite_url, created_at
                FROM tournaments
                WHERE status != 'completed'
                ORDER BY created_at DESC
            `
            return {
                statusCode: 200,
                headers: getHeaders(event),
                body: JSON.stringify(tournaments),
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournaments error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Test manually**

```bash
curl http://localhost:8788/api/tournaments
```

Expected: `[]` (empty array, no tournaments yet)

- [ ] **Step 3: Commit**

```bash
git add functions/api/tournaments.js
git commit -m "feat(tournament): add public tournaments GET endpoint"
```

---

## Task 3: Backend — Tournament Signup Endpoint

**Files:**
- Create: `functions/api/tournament-signup.js`

- [ ] **Step 1: Create the signup endpoint**

```js
import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, headers } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const sql = getDB()

    try {
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}
            if (!tournamentId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId required' }) }
            }

            const [signup] = await sql`
                SELECT ts.*, p.name as linked_player_name, p.tracker_url as linked_tracker_url
                FROM tournament_signups ts
                LEFT JOIN players p ON p.id = ts.player_id
                WHERE ts.tournament_id = ${tournamentId} AND ts.user_id = ${user.id}
            `

            // Also return linked player info for pre-filling the form
            let linkedPlayer = null
            if (user.linked_player_id) {
                const [p] = await sql`
                    SELECT id, name, tracker_url FROM players WHERE id = ${user.linked_player_id}
                `
                linkedPlayer = p || null
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ signup: signup || null, linkedPlayer }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { action } = body

            if (action === 'signup') {
                const { tournamentId, smiteName, trackerUrl, applyingAsCaptain, availableGameDates, availableDraftDate } = body

                if (!tournamentId || !smiteName) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and smiteName are required' }) }
                }

                // Check tournament exists and signups are open
                const [tournament] = await sql`
                    SELECT id, signups_open, game_dates FROM tournaments WHERE id = ${tournamentId}
                `
                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }
                if (!tournament.signups_open) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Signups are not open for this tournament' }) }
                }

                // Check for existing signup
                const [existing] = await sql`
                    SELECT id FROM tournament_signups
                    WHERE tournament_id = ${tournamentId} AND user_id = ${user.id}
                `
                if (existing) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'You have already signed up for this tournament' }) }
                }

                // Captain must be available for draft
                if (applyingAsCaptain && !availableDraftDate) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Captains must be available for the draft date' }) }
                }

                // Determine player_id — only auto-link if user has linked_player_id AND name matches
                let playerId = null
                let finalTrackerUrl = trackerUrl || null

                if (user.linked_player_id) {
                    const [linkedPlayer] = await sql`
                        SELECT id, name, tracker_url FROM players WHERE id = ${user.linked_player_id}
                    `
                    if (linkedPlayer && linkedPlayer.name.toLowerCase() === smiteName.toLowerCase()) {
                        playerId = linkedPlayer.id
                        finalTrackerUrl = linkedPlayer.tracker_url
                    }
                }

                // If no player linked and no tracker provided, require it
                if (!playerId && !finalTrackerUrl) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tracker URL is required when not matching an existing player' }) }
                }

                const [signup] = await sql`
                    INSERT INTO tournament_signups (
                        tournament_id, user_id, player_id, smite_name, tracker_url,
                        applying_as_captain, available_game_dates, available_draft_date
                    ) VALUES (
                        ${tournamentId}, ${user.id}, ${playerId}, ${smiteName}, ${finalTrackerUrl},
                        ${!!applyingAsCaptain}, ${JSON.stringify(availableGameDates || [])}, ${!!availableDraftDate}
                    ) RETURNING *
                `

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ signup }),
                }
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournament signup error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/tournament-signup.js
git commit -m "feat(tournament): add tournament signup endpoint with player matching"
```

---

## Task 4: Backend — Tournament Admin Endpoint

**Files:**
- Create: `functions/api/tournament-manage.js`

- [ ] **Step 1: Create the admin management endpoint**

```js
import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, adminHeaders as headers } from '../lib/db.js'
import { requirePermission } from '../lib/auth.js'
import { logAudit } from '../lib/audit.js'

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const admin = await requirePermission(event, 'tournament_manage')
    if (!admin) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const sql = getDB()

    try {
        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}

            // List all tournaments for admin
            if (!tournamentId) {
                const tournaments = await sql`
                    SELECT t.*, u.discord_username as created_by_name,
                           (SELECT count(*) FROM tournament_signups WHERE tournament_id = t.id) as signup_count,
                           (SELECT count(*) FROM tournament_signups WHERE tournament_id = t.id AND status = 'pending') as pending_count
                    FROM tournaments t
                    LEFT JOIN users u ON u.id = t.created_by
                    ORDER BY t.created_at DESC
                `
                return { statusCode: 200, headers, body: JSON.stringify(tournaments) }
            }

            // Get signups for a specific tournament
            const signups = await sql`
                SELECT ts.*,
                       u.discord_username, u.discord_avatar, u.discord_id,
                       p.name as player_name, p.tracker_url as player_tracker_url
                FROM tournament_signups ts
                JOIN users u ON u.id = ts.user_id
                LEFT JOIN players p ON p.id = ts.player_id
                WHERE ts.tournament_id = ${tournamentId}
                ORDER BY ts.created_at ASC
            `

            const [tournament] = await sql`
                SELECT * FROM tournaments WHERE id = ${tournamentId}
            `

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ tournament, signups }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { action } = body

            if (action === 'create') {
                const { name, slug, description, draftDate, gameDates, discordInviteUrl } = body
                if (!name || !slug) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and slug are required' }) }
                }

                const [tournament] = await sql`
                    INSERT INTO tournaments (name, slug, description, draft_date, game_dates, discord_invite_url, created_by)
                    VALUES (${name}, ${slug}, ${description || null}, ${draftDate || null},
                            ${JSON.stringify(gameDates || [])}, ${discordInviteUrl || null}, ${admin.id})
                    RETURNING *
                `

                await logAudit(sql, admin, {
                    action: 'create-tournament', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournament.id,
                    details: { name, slug },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'update') {
                const { tournamentId, name, slug, description, draftDate, gameDates, discordInviteUrl } = body
                if (!tournamentId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId is required' }) }
                }

                // Fetch current, then merge — allows clearing fields to null
                const [current] = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId}`
                if (!current) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                const merged = {
                    name: name !== undefined ? name : current.name,
                    slug: slug !== undefined ? slug : current.slug,
                    description: description !== undefined ? description : current.description,
                    draft_date: draftDate !== undefined ? (draftDate || null) : current.draft_date,
                    game_dates: gameDates !== undefined ? JSON.stringify(gameDates) : JSON.stringify(current.game_dates || []),
                    discord_invite_url: discordInviteUrl !== undefined ? (discordInviteUrl || null) : current.discord_invite_url,
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET
                        name = ${merged.name},
                        slug = ${merged.slug},
                        description = ${merged.description},
                        draft_date = ${merged.draft_date},
                        game_dates = ${merged.game_dates}::jsonb,
                        discord_invite_url = ${merged.discord_invite_url},
                        updated_at = now()
                    WHERE id = ${tournamentId}
                    RETURNING *
                `

                await logAudit(sql, admin, {
                    action: 'update-tournament', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { name, slug },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'toggle-signups') {
                const { tournamentId } = body
                if (!tournamentId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId is required' }) }
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET signups_open = NOT signups_open, updated_at = now()
                    WHERE id = ${tournamentId} RETURNING *
                `

                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'toggle-signups', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { signups_open: tournament.signups_open },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'update-status') {
                const { tournamentId, status } = body
                if (!tournamentId || !status) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and status are required' }) }
                }
                if (!['upcoming', 'in_progress', 'completed'].includes(status)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) }
                }

                const [tournament] = await sql`
                    UPDATE tournaments SET status = ${status}, updated_at = now()
                    WHERE id = ${tournamentId} RETURNING *
                `

                if (!tournament) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tournament not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'update-tournament-status', endpoint: 'tournament-manage',
                    targetType: 'tournament', targetId: tournamentId,
                    details: { status },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ tournament }) }
            }

            if (action === 'review-signup') {
                const { signupId, status } = body
                if (!signupId || !status) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'signupId and status are required' }) }
                }
                if (!['approved', 'rejected'].includes(status)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Status must be approved or rejected' }) }
                }

                const [signup] = await sql`
                    UPDATE tournament_signups SET
                        status = ${status},
                        reviewed_by = ${admin.id},
                        reviewed_at = now(),
                        updated_at = now()
                    WHERE id = ${signupId}
                    RETURNING *
                `

                if (!signup) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signup not found' }) }
                }

                await logAudit(sql, admin, {
                    action: 'review-tournament-signup', endpoint: 'tournament-manage',
                    targetType: 'tournament_signup', targetId: signupId,
                    details: { status, tournament_id: signup.tournament_id },
                })

                return { statusCode: 200, headers, body: JSON.stringify({ signup }) }
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('Tournament manage error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
    }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/tournament-manage.js
git commit -m "feat(tournament): add admin tournament management endpoint"
```

---

## Task 5: Frontend — Service Layer

**Files:**
- Modify: `src/services/database.js` (add at end of file, around line 1374)

- [ ] **Step 1: Add tournament service functions**

Add the following at the end of `src/services/database.js`, before any closing exports:

```js
export const tournamentService = {
    async getAll() {
        return apiCall('tournaments')
    },
    async getBySlug(slug) {
        return apiCall('tournaments', { slug })
    },
    async getSignup(tournamentId) {
        return apiCall('tournament-signup', { tournamentId })
    },
    async signup(data) {
        return apiPost('tournament-signup', {}, { action: 'signup', ...data })
    },
    // Admin
    async adminList() {
        return apiCall('tournament-manage')
    },
    async adminGetSignups(tournamentId) {
        return apiCall('tournament-manage', { tournamentId })
    },
    async adminCreate(data) {
        return apiPost('tournament-manage', {}, { action: 'create', ...data })
    },
    async adminUpdate(data) {
        return apiPost('tournament-manage', {}, { action: 'update', ...data })
    },
    async adminToggleSignups(tournamentId) {
        return apiPost('tournament-manage', {}, { action: 'toggle-signups', tournamentId })
    },
    async adminUpdateStatus(tournamentId, status) {
        return apiPost('tournament-manage', {}, { action: 'update-status', tournamentId, status })
    },
    async adminReviewSignup(signupId, status) {
        return apiPost('tournament-manage', {}, { action: 'review-signup', signupId, status })
    },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database.js
git commit -m "feat(tournament): add tournament service layer"
```

---

## Task 6: Frontend — Public Tournament Signup Page

**Files:**
- Create: `src/pages/TournamentSignup.jsx`

- [ ] **Step 1: Create the tournament signup page**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { tournamentService } from '../services/database'
import { Calendar, Shield, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react'

function StatusBadge({ status }) {
    const config = {
        pending: { label: 'Pending Review', icon: Clock, cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        approved: { label: 'Approved', icon: CheckCircle, cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
        rejected: { label: 'Rejected', icon: XCircle, cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }
    const c = config[status] || config.pending
    const Icon = c.icon
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${c.cls}`}>
            <Icon className="w-4 h-4" /> {c.label}
        </span>
    )
}

function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
}

export default function TournamentSignup() {
    const { slug } = useParams()
    const { user, login, loading: authLoading } = useAuth()

    const [tournament, setTournament] = useState(null)
    const [signup, setSignup] = useState(null)
    const [linkedPlayer, setLinkedPlayer] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [submitSuccess, setSubmitSuccess] = useState(false)

    // Form state
    const [smiteName, setSmiteName] = useState('')
    const [trackerUrl, setTrackerUrl] = useState('')
    const [nameChanged, setNameChanged] = useState(false)
    const [applyingAsCaptain, setApplyingAsCaptain] = useState(false)
    const [availableDraftDate, setAvailableDraftDate] = useState(false)
    const [availableGameDates, setAvailableGameDates] = useState([])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const t = await tournamentService.getBySlug(slug)
            setTournament(t)

            if (user) {
                const { signup: s, linkedPlayer: lp } = await tournamentService.getSignup(t.id)
                setSignup(s)
                setLinkedPlayer(lp)
                if (lp && !s) {
                    setSmiteName(lp.name || '')
                    setTrackerUrl(lp.tracker_url || '')
                }
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [slug, user])

    useEffect(() => { fetchData() }, [fetchData])

    const handleSmiteNameChange = (val) => {
        setSmiteName(val)
        setNameChanged(linkedPlayer ? val.toLowerCase() !== linkedPlayer.name.toLowerCase() : true)
    }

    const toggleGameDate = (date) => {
        setAvailableGameDates(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setSubmitError(null)
        try {
            await tournamentService.signup({
                tournamentId: tournament.id,
                smiteName,
                trackerUrl: nameChanged ? trackerUrl : undefined,
                applyingAsCaptain,
                availableGameDates,
                availableDraftDate,
            })
            setSubmitSuccess(true)
            fetchData()
        } catch (err) {
            setSubmitError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading || authLoading) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
            </div>
        )
    }

    if (!tournament) return null

    const gameDates = tournament.game_dates || []

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-(--color-text) mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                    {tournament.name}
                </h1>
                <div className="flex items-center gap-2 text-(--color-text-secondary) text-sm">
                    {tournament.status === 'upcoming' && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">Upcoming</span>}
                    {tournament.status === 'in_progress' && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium">In Progress</span>}
                    {tournament.status === 'completed' && <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 text-xs font-medium">Completed</span>}
                </div>
            </div>

            {/* Description / Marketing Copy */}
            {tournament.description && (
                <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-(--color-text) whitespace-pre-wrap leading-relaxed">{tournament.description}</div>
                </div>
            )}

            {/* Dates */}
            <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
                <h2 className="text-lg font-semibold text-(--color-text) mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-(--color-accent)" /> Tournament Dates
                </h2>
                {tournament.draft_date && (
                    <div className="mb-3">
                        <span className="text-(--color-text-secondary) text-sm">Draft Day (Captains Only):</span>
                        <div className="text-(--color-text) font-medium">{formatDate(tournament.draft_date)}</div>
                    </div>
                )}
                {gameDates.length > 0 && (
                    <div>
                        <span className="text-(--color-text-secondary) text-sm">Game Days:</span>
                        {gameDates.map(d => (
                            <div key={d} className="text-(--color-text) font-medium">{formatDate(d)}</div>
                        ))}
                    </div>
                )}
            </div>

            {/* Discord Requirement */}
            {tournament.discord_invite_url && (
                <div className="mb-8 p-4 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
                    <div className="flex items-center gap-3">
                        <div className="text-(--color-text) text-sm font-medium">You must join the SmiteComp Discord to participate</div>
                        <a
                            href={tournament.discord_invite_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752C4] transition-colors"
                        >
                            Join Discord <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            )}

            {/* Signup Section */}
            {!user ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-(--color-text-secondary) mb-4">You must be logged in to sign up for this tournament.</p>
                    <button onClick={login} className="px-6 py-2.5 rounded-lg bg-(--color-accent) text-black font-semibold hover:opacity-90 transition-opacity">
                        Log in with Discord
                    </button>
                </div>
            ) : signup || submitSuccess ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                    <h2 className="text-lg font-semibold text-(--color-text) mb-3">Your Signup</h2>
                    <div className="flex items-center gap-3 mb-2">
                        <StatusBadge status={signup?.status || 'pending'} />
                    </div>
                    {signup && (
                        <div className="mt-3 space-y-1 text-sm text-(--color-text-secondary)">
                            <div>Smite Name: <span className="text-(--color-text)">{signup.smite_name}</span></div>
                            {signup.applying_as_captain && <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-(--color-accent)" /> Applied as Captain</div>}
                        </div>
                    )}
                </div>
            ) : !tournament.signups_open ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-(--color-text-secondary)">Signups are currently closed for this tournament.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-6">
                    <h2 className="text-lg font-semibold text-(--color-text)">Sign Up</h2>

                    {submitError && (
                        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{submitError}</div>
                    )}

                    {/* Smite Name */}
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Smite Name</label>
                        <input
                            type="text"
                            value={smiteName}
                            onChange={e => handleSmiteNameChange(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                            placeholder="Your SMITE 2 in-game name"
                        />
                        {linkedPlayer && !nameChanged && (
                            <p className="mt-1 text-xs text-green-400">Matched to existing player record</p>
                        )}
                    </div>

                    {/* Tracker URL — shown only if name changed or no linked player */}
                    {(nameChanged || !linkedPlayer) && (
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Tracker URL</label>
                            <input
                                type="url"
                                value={trackerUrl}
                                onChange={e => setTrackerUrl(e.target.value)}
                                required
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                placeholder="https://www.smitetracker.com/profile/..."
                            />
                        </div>
                    )}

                    {/* Game Day Availability */}
                    {gameDates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-(--color-text-secondary) mb-2">Game Day Availability</label>
                            <div className="space-y-2">
                                {gameDates.map(date => (
                                    <label key={date} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={availableGameDates.includes(date)}
                                            onChange={() => toggleGameDate(date)}
                                            className="w-4 h-4 rounded accent-(--color-accent)"
                                        />
                                        <span className="text-(--color-text) text-sm">{formatDate(date)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Captain Toggle */}
                    <div>
                        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                            <input
                                type="checkbox"
                                checked={applyingAsCaptain}
                                onChange={e => {
                                    setApplyingAsCaptain(e.target.checked)
                                    if (!e.target.checked) setAvailableDraftDate(false)
                                }}
                                className="w-4 h-4 rounded accent-(--color-accent)"
                            />
                            <div>
                                <div className="text-(--color-text) text-sm font-medium flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-(--color-accent)" /> Apply as Captain
                                </div>
                                <div className="text-(--color-text-secondary) text-xs mt-0.5">Captains draft their teams and lead them through the tournament</div>
                            </div>
                        </label>
                    </div>

                    {/* Draft Date Availability — shown only if applying as captain */}
                    {applyingAsCaptain && tournament.draft_date && (
                        <div>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={availableDraftDate}
                                    onChange={e => setAvailableDraftDate(e.target.checked)}
                                    required
                                    className="w-4 h-4 rounded accent-(--color-accent)"
                                />
                                <div>
                                    <div className="text-(--color-text) text-sm font-medium">Available for Draft Day</div>
                                    <div className="text-(--color-text-secondary) text-xs mt-0.5">{formatDate(tournament.draft_date)} — required for captains</div>
                                </div>
                            </label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || (applyingAsCaptain && !availableDraftDate)}
                        className="w-full py-3 rounded-lg bg-(--color-accent) text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                        {submitting ? 'Submitting...' : 'Sign Up'}
                    </button>
                </form>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/TournamentSignup.jsx
git commit -m "feat(tournament): add public tournament signup page"
```

---

## Task 7: Frontend — Admin Tournament Manager Page

**Files:**
- Create: `src/pages/admin/TournamentManager.jsx`

- [ ] **Step 1: Create the admin tournament manager page**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { tournamentService } from '../../services/database'
import { Plus, Save, ToggleLeft, ToggleRight, CheckCircle, XCircle, Clock, Shield, ChevronLeft, Trash2 } from 'lucide-react'

function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
    })
}

function SignupStatusBadge({ status }) {
    const config = {
        pending: { label: 'Pending', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        approved: { label: 'Approved', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
        rejected: { label: 'Rejected', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }
    const c = config[status] || config.pending
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>{c.label}</span>
}

export default function TournamentManager() {
    const [tournaments, setTournaments] = useState([])
    const [selected, setSelected] = useState(null)
    const [signups, setSignups] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)
    const [filter, setFilter] = useState('all')
    const [creating, setCreating] = useState(false)

    // Form state for create/edit
    const [form, setForm] = useState({ name: '', slug: '', description: '', draftDate: '', gameDates: '', discordInviteUrl: '' })

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchTournaments = useCallback(async () => {
        try {
            setLoading(true)
            const data = await tournamentService.adminList()
            setTournaments(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSignups = useCallback(async (tournamentId) => {
        try {
            const { tournament, signups: s } = await tournamentService.adminGetSignups(tournamentId)
            setSelected(tournament)
            setSignups(s)
            setForm({
                name: tournament.name,
                slug: tournament.slug,
                description: tournament.description || '',
                draftDate: tournament.draft_date || '',
                gameDates: (tournament.game_dates || []).join(', '),
                discordInviteUrl: tournament.discord_invite_url || '',
            })
        } catch (err) {
            showToast(err.message, 'error')
        }
    }, [])

    useEffect(() => { fetchTournaments() }, [fetchTournaments])

    const handleCreate = async () => {
        if (!form.name || !form.slug) return showToast('Name and slug are required', 'error')
        setSaving(true)
        try {
            const gameDates = form.gameDates ? form.gameDates.split(',').map(d => d.trim()).filter(Boolean) : []
            const { tournament } = await tournamentService.adminCreate({
                name: form.name,
                slug: form.slug,
                description: form.description,
                draftDate: form.draftDate || null,
                gameDates,
                discordInviteUrl: form.discordInviteUrl,
            })
            showToast('Tournament created')
            setCreating(false)
            fetchTournaments()
            fetchSignups(tournament.id)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleUpdate = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const gameDates = form.gameDates ? form.gameDates.split(',').map(d => d.trim()).filter(Boolean) : []
            await tournamentService.adminUpdate({
                tournamentId: selected.id,
                name: form.name,
                slug: form.slug,
                description: form.description,
                draftDate: form.draftDate || null,
                gameDates,
                discordInviteUrl: form.discordInviteUrl,
            })
            showToast('Tournament updated')
            fetchSignups(selected.id)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleSignups = async () => {
        if (!selected) return
        try {
            const { tournament } = await tournamentService.adminToggleSignups(selected.id)
            setSelected(tournament)
            showToast(tournament.signups_open ? 'Signups opened' : 'Signups closed')
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const handleStatusChange = async (status) => {
        if (!selected) return
        try {
            const { tournament } = await tournamentService.adminUpdateStatus(selected.id, status)
            setSelected(tournament)
            showToast(`Status updated to ${status}`)
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const handleReview = async (signupId, status) => {
        try {
            await tournamentService.adminReviewSignup(signupId, status)
            showToast(`Signup ${status}`)
            fetchSignups(selected.id)
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const filteredSignups = signups.filter(s => filter === 'all' || s.status === filter)

    const counts = {
        total: signups.length,
        pending: signups.filter(s => s.status === 'pending').length,
        approved: signups.filter(s => s.status === 'approved').length,
        rejected: signups.filter(s => s.status === 'rejected').length,
        captains: signups.filter(s => s.status === 'approved' && s.applying_as_captain).length,
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    // Tournament list view
    if (!selected && !creating) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-(--color-text)" style={{ fontFamily: 'var(--font-heading)' }}>Tournaments</h1>
                    <button
                        onClick={() => { setCreating(true); setForm({ name: '', slug: '', description: '', draftDate: '', gameDates: '', discordInviteUrl: '' }) }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> New Tournament
                    </button>
                </div>

                {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>}

                {tournaments.length === 0 ? (
                    <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-(--color-text-secondary)">No tournaments yet</div>
                ) : (
                    <div className="space-y-3">
                        {tournaments.map(t => (
                            <button
                                key={t.id}
                                onClick={() => fetchSignups(t.id)}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-(--color-text) font-semibold">{t.name}</div>
                                        <div className="text-(--color-text-secondary) text-sm mt-0.5">/{t.slug}</div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-(--color-text-secondary)">{t.signup_count} signups ({t.pending_count} pending)</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                            t.signups_open ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>{t.signups_open ? 'Open' : 'Closed'}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Create / Edit form + signups
    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-center gap-2">
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">X</button>
                    </div>
                </div>
            )}

            {/* Back button */}
            <button
                onClick={() => { setSelected(null); setCreating(false); fetchTournaments() }}
                className="flex items-center gap-1.5 text-(--color-text-secondary) hover:text-(--color-text) text-sm mb-6 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" /> Back to Tournaments
            </button>

            <h1 className="text-2xl font-bold text-(--color-text) mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
                {creating ? 'Create Tournament' : selected?.name}
            </h1>

            {/* Edit Form */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 mb-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Name</label>
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Slug</label>
                        <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Description (Marketing Copy)</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50 resize-y" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Draft Date</label>
                        <input type="date" value={form.draftDate} onChange={e => setForm(f => ({ ...f, draftDate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Game Dates (comma-separated: 2026-04-05, 2026-04-06)</label>
                        <input type="text" value={form.gameDates} onChange={e => setForm(f => ({ ...f, gameDates: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50"
                            placeholder="2026-04-05, 2026-04-06" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Discord Invite URL</label>
                    <input type="url" value={form.discordInviteUrl} onChange={e => setForm(f => ({ ...f, discordInviteUrl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50"
                        placeholder="https://discord.gg/..." />
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={creating ? handleCreate : handleUpdate}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                        <Save className="w-4 h-4" /> {creating ? 'Create' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Controls (only when editing existing) */}
            {selected && (
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={handleToggleSignups} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm hover:bg-white/10 transition-colors">
                        {selected.signups_open ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-(--color-text-secondary)" />}
                        Signups {selected.signups_open ? 'Open' : 'Closed'}
                    </button>
                    <select
                        value={selected.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                    >
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            )}

            {/* Signups Table (only when editing existing) */}
            {selected && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-(--color-text)">
                            Signups
                            <span className="ml-2 text-sm font-normal text-(--color-text-secondary)">
                                {counts.total} total / {counts.pending} pending / {counts.approved} approved ({counts.captains} captains) / {counts.rejected} rejected
                            </span>
                        </h2>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1 mb-4">
                        {['all', 'pending', 'approved', 'rejected'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    filter === f ? 'bg-(--color-accent) text-black' : 'text-(--color-text-secondary) hover:bg-white/5'
                                }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {filteredSignups.length === 0 ? (
                        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-(--color-text-secondary)">
                            No {filter === 'all' ? '' : filter} signups
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Player</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Smite Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Captain</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Available Dates</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredSignups.map(s => (
                                        <tr key={s.id}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {s.discord_avatar ? (
                                                        <img src={`https://cdn.discordapp.com/avatars/${s.discord_id}/${s.discord_avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-full" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                                            {s.discord_username?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-(--color-text)">{s.discord_username}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-(--color-text)">{s.smite_name}</div>
                                                {s.tracker_url && (
                                                    <a href={s.tracker_url} target="_blank" rel="noopener noreferrer" className="text-xs text-(--color-accent) hover:underline">tracker</a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {s.applying_as_captain && <Shield className="w-4 h-4 text-(--color-accent)" />}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(s.available_game_dates || []).map(d => (
                                                        <span key={d} className="px-1.5 py-0.5 rounded bg-white/5 text-xs text-(--color-text-secondary)">{formatDate(d)}</span>
                                                    ))}
                                                    {s.available_draft_date && (
                                                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-xs text-yellow-400">Draft</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><SignupStatusBadge status={s.status} /></td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {s.status !== 'approved' && (
                                                        <button onClick={() => handleReview(s.id, 'approved')}
                                                            className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-green-400 transition-colors" title="Approve">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {s.status !== 'rejected' && (
                                                        <button onClick={() => handleReview(s.id, 'rejected')}
                                                            className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors" title="Reject">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/TournamentManager.jsx
git commit -m "feat(tournament): add admin tournament manager page"
```

---

## Task 8: Frontend — Route & Sidebar Wiring

**Files:**
- Modify: `src/App.jsx:88` (add import), `src/App.jsx:189` (add admin route), `src/App.jsx:264` (add public route)
- Modify: `src/components/layout/AdminNavbar.jsx:37` (add sidebar link)

- [ ] **Step 1: Add import to App.jsx**

At line 88 (after `import VaultAdmin from "./pages/admin/VaultAdmin.jsx"`), add:

```js
import TournamentManager from "./pages/admin/TournamentManager.jsx";
```

At line 92 (after `import Features from "./pages/Features.jsx"`), add:

```js
import TournamentSignup from "./pages/TournamentSignup.jsx";
```

- [ ] **Step 2: Add admin route to App.jsx**

At line 189 (after the `settings` route, before the closing `</Route>` for admin), add:

```jsx
                                <Route path="tournaments" element={<ProtectedRoute requiredPermission="tournament_manage"><TournamentManager /></ProtectedRoute>} />
```

- [ ] **Step 3: Add public route to App.jsx**

At line 264 (after the SAL signup route), add:

```jsx
                            {/* Tournament signup */}
                            <Route path="tournaments/:slug" element={<TournamentSignup />} />
```

- [ ] **Step 4: Add sidebar link to AdminNavbar.jsx**

In the `morePages` array at `src/components/layout/AdminNavbar.jsx:37` (after the `auditlog` entry), add:

```js
    { path: '/admin/tournaments',  label: 'Tournaments',     permission: 'tournament_manage', globalOnly: true },
```

- [ ] **Step 5: Verify the dev server starts without errors**

```bash
npm run dev
```

Expected: Vite starts without compile errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/layout/AdminNavbar.jsx
git commit -m "feat(tournament): wire tournament routes and admin sidebar link"
```

---

## Task 9: End-to-End Smoke Test

- [ ] **Step 1: Start the full dev server**

```bash
npm start
```

- [ ] **Step 2: Test admin flow**

1. Go to `/admin/tournaments`
2. Create a tournament with name, slug, dates, description, discord URL
3. Toggle signups open
4. Verify the tournament appears in the list

- [ ] **Step 3: Test public flow**

1. Go to `/tournaments/<slug>` (the slug you just created)
2. Verify tournament info, dates, and description display
3. Sign up with smite name, select game dates
4. Verify "Pending Review" status shows after submit

- [ ] **Step 4: Test approval flow**

1. Back in `/admin/tournaments`, select the tournament
2. Verify the signup appears in the table
3. Approve the signup
4. Verify the status updates

- [ ] **Step 5: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "feat(tournament): complete tournament signup system"
```

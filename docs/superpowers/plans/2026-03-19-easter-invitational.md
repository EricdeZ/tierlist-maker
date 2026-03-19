# Easter Invitational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/tournaments/easter-invitational` into an Easter-themed page with animated top-down grass field, cursor-chasing bunny, wandering chicks, egg hunt mini-game that awards Cores, and polished signup form.

**Architecture:** Slug-gated theming in `TournamentSignup.jsx` — when slug is `easter-invitational`, render a full-page canvas overlay for game elements (bunny, chicks, eggs) on a grass texture background, with CSS hedge banner and glassmorphism form card on top. Server-side endpoint tracks egg hunt plays (max 5) and awards Cores via `grantEmber()`.

**Tech Stack:** React 19, Canvas 2D API, Tailwind CSS 4, Cloudflare Pages Functions, Neon PostgreSQL, `grantEmber()` from `functions/lib/ember.js`

**Spec:** `docs/superpowers/specs/2026-03-19-easter-invitational-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/127-tournament-egg-hunts.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE tournament_egg_hunts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    eggs_collected INTEGER NOT NULL DEFAULT 0,
    cores_awarded INTEGER NOT NULL DEFAULT 0,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_egg_hunts_user_tournament ON tournament_egg_hunts(user_id, tournament_id);
```

- [ ] **Step 2: Run migration against dev database**

Run: `psql $DATABASE_URL -f database/migrations/127-tournament-egg-hunts.sql`
Expected: CREATE TABLE, CREATE INDEX

- [ ] **Step 3: Commit**

```bash
git add database/migrations/127-tournament-egg-hunts.sql
git commit -m "feat(easter): add tournament_egg_hunts migration"
```

---

### Task 2: API Endpoint — tournament-egg-hunt.js

**Files:**
- Create: `functions/api/tournament-egg-hunt.js`
- Reference: `functions/lib/adapter.js`, `functions/lib/db.js`, `functions/lib/auth.js`, `functions/lib/ember.js`

- [ ] **Step 1: Create endpoint**

```javascript
import { adapt } from '../lib/adapter.js'
import { getDB, handleCors, headers, transaction } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { grantEmber } from '../lib/ember.js'

const MAX_PLAYS = 5
const MAX_EGGS = 200
const MIN_PLAY_INTERVAL_MS = 110000 // ~1:50 — slightly under 2min to account for network

const handler = async (event) => {
    const cors = handleCors(event)
    if (cors) return cors

    const user = await requireAuth(event)
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Login required' }) }
    }

    try {
        if (event.httpMethod === 'GET') {
            const { tournamentId } = event.queryStringParameters || {}
            if (!tournamentId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId required' }) }
            }
            const sql = getDB()
            const plays = await sql`
                SELECT COUNT(*)::int AS plays_used
                FROM tournament_egg_hunts
                WHERE user_id = ${user.id} AND tournament_id = ${parseInt(tournamentId)}
            `
            const playsUsed = plays[0]?.plays_used || 0
            return {
                statusCode: 200, headers,
                body: JSON.stringify({ playsUsed, playsRemaining: MAX_PLAYS - playsUsed }),
            }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}
            const { tournamentId, eggsCollected } = body

            if (!tournamentId || eggsCollected == null) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'tournamentId and eggsCollected required' }) }
            }

            const eggs = Math.min(Math.max(0, Math.floor(eggsCollected)), MAX_EGGS)

            const result = await transaction(async (tx) => {
                // Validate tournament exists
                const [tournament] = await tx`SELECT id FROM tournaments WHERE id = ${parseInt(tournamentId)}`
                if (!tournament) throw new Error('Tournament not found')

                // Check play count + rate limit atomically
                const plays = await tx`
                    SELECT COUNT(*)::int AS plays_used, MAX(played_at) AS last_played
                    FROM tournament_egg_hunts
                    WHERE user_id = ${user.id} AND tournament_id = ${tournament.id}
                `
                const playsUsed = plays[0]?.plays_used || 0
                if (playsUsed >= MAX_PLAYS) throw new Error('No plays remaining')

                const lastPlayed = plays[0]?.last_played
                if (lastPlayed && (Date.now() - new Date(lastPlayed).getTime()) < MIN_PLAY_INTERVAL_MS) {
                    throw new Error('Please wait before playing again')
                }

                // Insert play record
                const [hunt] = await tx`
                    INSERT INTO tournament_egg_hunts (user_id, tournament_id, eggs_collected, cores_awarded)
                    VALUES (${user.id}, ${tournament.id}, ${eggs}, ${eggs})
                    RETURNING id
                `

                // Award cores
                if (eggs > 0) {
                    await grantEmber(tx, user.id, 'egg_hunt', eggs, `Easter egg hunt: ${eggs} eggs`, hunt.id)
                }

                return { coresAwarded: eggs, playsRemaining: MAX_PLAYS - playsUsed - 1 }
            })

            return { statusCode: 200, headers, body: JSON.stringify(result) }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        const status = error.message.includes('No plays') || error.message.includes('Please wait') ? 400 : 500
        return { statusCode: status, headers, body: JSON.stringify({ error: error.message }) }
    }
}

export const onRequest = adapt(handler)
```

- [ ] **Step 2: Add service methods to database.js**

In `src/services/database.js`, add to `tournamentService`:

```javascript
async eggHuntStatus(tournamentId) {
    return apiCall('tournament-egg-hunt', { tournamentId })
},
async eggHuntComplete(tournamentId, eggsCollected) {
    return apiPost('tournament-egg-hunt', {}, { tournamentId, eggsCollected })
},
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/tournament-egg-hunt.js src/services/database.js
git commit -m "feat(easter): add egg hunt API endpoint + service methods"
```

---

### Task 3: Grass Texture Asset

**Files:**
- Create: `src/assets/easter/grass-tile.jpg`

- [ ] **Step 1: Source a seamless top-down grass tile**

Find a free seamless tileable top-down grass texture (256x256 or 512x512). Options:
- Use a CSS-generated grass pattern as the actual implementation (no external asset needed)
- Or download from a free texture site and commit

For a pure CSS approach, create the pattern in `easter.css` using layered gradients:
```css
.easter-grass-bg {
    background-color: #2d5a1e;
    background-image:
        radial-gradient(ellipse at 30% 40%, #3a7a28 0%, transparent 50%),
        radial-gradient(ellipse at 70% 60%, #3a7a28 0%, transparent 40%),
        radial-gradient(ellipse at 50% 20%, #4a8a38 0%, transparent 30%),
        repeating-linear-gradient(90deg, transparent 0px, rgba(34,100,20,0.1) 2px, transparent 4px),
        repeating-linear-gradient(0deg, transparent 0px, rgba(34,100,20,0.1) 2px, transparent 4px);
}
```

If a real texture is sourced, place at `src/assets/easter/grass-tile.jpg` and reference via import.

- [ ] **Step 2: Commit**

```bash
git add src/assets/easter/ src/pages/tournament/easter.css
git commit -m "feat(easter): add grass background asset/pattern"
```

---

### Task 4: Easter CSS — Hedge Banner + Form Polish

**Files:**
- Create: `src/pages/tournament/easter.css`

- [ ] **Step 1: Create easter.css with all themed styles**

```css
/* Grass background */
.easter-bg {
    min-height: 100vh;
    position: relative;
    background-color: #2d5a1e;
    background-image:
        radial-gradient(ellipse at 30% 40%, #3a7a28 0%, transparent 50%),
        radial-gradient(ellipse at 70% 60%, #3a7a28 0%, transparent 40%),
        radial-gradient(ellipse at 50% 20%, #4a8a38 0%, transparent 30%);
}

/* If real grass tile is available, layer it */
.easter-bg.has-texture {
    background-image: url('../../assets/easter/grass-tile.jpg');
    background-repeat: repeat;
    background-size: 256px 256px;
}

/* Canvas overlay */
.easter-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
}

/* Hedge banner */
.easter-hedge-banner {
    position: relative;
    z-index: 2;
    text-align: center;
    padding: 2rem 1rem;
}

.easter-hedge-text {
    font-size: clamp(2rem, 6vw, 4.5rem);
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #4ade80 0%, #16a34a 40%, #0d6a28 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
    position: relative;
}

/* Leaf texture overlay on hedge text */
.easter-hedge-text::after {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    background: repeating-radial-gradient(circle at 3px 3px, rgba(34, 197, 94, 0.15) 0px, transparent 2px);
    background-size: 6px 6px;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    pointer-events: none;
}

/* Form card — glassmorphism over grass */
.easter-form-card {
    position: relative;
    z-index: 2;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(74, 222, 128, 0.15);
    border-radius: 1rem;
}

.easter-form-card input,
.easter-form-card select {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(74, 222, 128, 0.15);
}

.easter-form-card input:focus,
.easter-form-card select:focus {
    border-color: rgba(74, 222, 128, 0.4);
    outline: none;
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.1);
}

/* Submit button — Easter green gradient */
.easter-submit-btn {
    background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%) !important;
    color: white !important;
    font-weight: 700;
    border-radius: 0.75rem;
    transition: filter 0.2s;
}
.easter-submit-btn:hover:not(:disabled) {
    filter: brightness(1.1);
}
.easter-submit-btn:disabled {
    opacity: 0.4;
}

/* HUD */
.easter-hud {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    pointer-events: none;
}

.easter-hud-item {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 0.75rem;
    padding: 0.5rem 1rem;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    pointer-events: auto;
}

.easter-hud-timer {
    font-variant-numeric: tabular-nums;
    font-family: monospace;
}

.easter-hud-score {
    color: #4ade80;
    animation: easter-glow 1.5s ease-out;
}

@keyframes easter-glow {
    0% { text-shadow: 0 0 20px rgba(74, 222, 128, 0.8); transform: scale(1.2); }
    100% { text-shadow: none; transform: scale(1); }
}

.easter-hud-play-again {
    pointer-events: auto;
    cursor: pointer;
    background: rgba(74, 222, 128, 0.2);
    border-color: rgba(74, 222, 128, 0.4);
    transition: background 0.2s;
}
.easter-hud-play-again:hover {
    background: rgba(74, 222, 128, 0.3);
}

/* Info sections inside form */
.easter-info-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 222, 128, 0.1);
    border-radius: 0.75rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/tournament/easter.css
git commit -m "feat(easter): add Easter CSS — hedge banner, form polish, HUD styles"
```

---

### Task 5: EasterCanvas Component — Drawing + Animation

**Files:**
- Create: `src/pages/tournament/EasterCanvas.jsx`

- [ ] **Step 1: Create EasterCanvas with bunny, chicks, eggs, and game loop**

This is the core canvas component. It handles:
- Full-page canvas element
- Mouse/touch tracking for bunny position
- Bunny drawing (top-down: oval body, ears, eyes, tail)
- Chick drawing (top-down: yellow circle, beak, eyes) with wander AI
- Egg drawing (colorful ovals with stripes)
- Collision detection (bunny vs eggs)
- `requestAnimationFrame` loop
- Communicates game events to parent via callbacks

Props:
- `formRef` — ref to form element for exclusion zone
- `gameState` — 'idle' | 'active' | 'ended'
- `onEggCollected` — callback when egg is collected
- `enabled` — whether egg collection is active (false when ended or no plays)

The component should:
1. Set up canvas to fill window, handle resize
2. Track mouse/touch position
3. Lerp bunny toward cursor each frame
4. Spawn 4-6 chicks with wander behavior
5. Spawn 3-5 eggs at random valid positions
6. Each frame: update positions, check collisions, draw everything
7. When bunny overlaps egg and `enabled`: call `onEggCollected()`, remove egg, spawn new one

Key drawing functions to implement:
- `drawBunny(ctx, x, y, angle)` — top-down bunny (white oval, pink-inner ears, dot eyes)
- `drawChick(ctx, x, y, angle)` — top-down chick (yellow circle, orange beak, dot eyes)
- `drawEgg(ctx, x, y, color)` — colorful oval with stripe band
- `isInsideExclusionZone(x, y, formRect)` — check if point is inside form card area
- `getRandomSpawnPoint(formRect, bunnyPos)` — random point outside form, away from bunny

- [ ] **Step 2: Commit**

```bash
git add src/pages/tournament/EasterCanvas.jsx
git commit -m "feat(easter): add EasterCanvas — bunny, chicks, eggs, game loop"
```

---

### Task 6: EasterHUD Component

**Files:**
- Create: `src/pages/tournament/EasterHUD.jsx`

- [ ] **Step 1: Create HUD component**

Props:
- `eggsCollected` — number
- `timeRemaining` — seconds remaining (null if not started)
- `gameState` — 'idle' | 'active' | 'ended'
- `coresAwarded` — number (shown after game ends)
- `playsRemaining` — number
- `onPlayAgain` — callback

Renders:
- Egg counter: `🥚 {count}`
- Timer (when active): `⏱ M:SS`
- Score (when ended): `+{coresAwarded} Cores` with glow animation
- Play again button (when ended + plays > 0)
- Plays remaining: `{n}/5 hunts`

- [ ] **Step 2: Commit**

```bash
git add src/pages/tournament/EasterHUD.jsx
git commit -m "feat(easter): add EasterHUD — counter, timer, score display"
```

---

### Task 7: Integrate Everything into TournamentSignup.jsx

**Files:**
- Modify: `src/pages/TournamentSignup.jsx`

- [ ] **Step 1: Add Easter slug detection and state management**

At top of `TournamentSignup` component, add:
```javascript
const isEaster = slug === 'easter-invitational'
```

Add egg hunt state:
```javascript
const [gameState, setGameState] = useState('idle') // idle | active | ended
const [eggsCollected, setEggsCollected] = useState(0)
const [startTime, setStartTime] = useState(null)
const [timeRemaining, setTimeRemaining] = useState(null)
const [coresAwarded, setCoresAwarded] = useState(null)
const [playsRemaining, setPlaysRemaining] = useState(null)
const [playsLoading, setPlaysLoading] = useState(false)
const formRef = useRef(null)
```

Add imports at top:
```javascript
import { lazy } from 'react'
const EasterCanvas = lazy(() => import('./tournament/EasterCanvas'))
const EasterHUD = lazy(() => import('./tournament/EasterHUD'))
```

And `import './tournament/easter.css'` conditionally or at top.

- [ ] **Step 2: Add game logic — timer, egg collection, API calls**

Fetch play status on mount when Easter:
```javascript
useEffect(() => {
    if (!isEaster || !user || !tournament) return
    tournamentService.eggHuntStatus(tournament.id).then(data => {
        setPlaysRemaining(data.playsRemaining)
    }).catch(() => {})
}, [isEaster, user, tournament])
```

Timer effect (runs when game is active):
```javascript
useEffect(() => {
    if (gameState !== 'active' || !startTime) return
    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 120 - Math.floor(elapsed / 1000))
        setTimeRemaining(remaining)
        if (remaining <= 0) {
            setGameState('ended')
            clearInterval(interval)
        }
    }, 200)
    return () => clearInterval(interval)
}, [gameState, startTime])
```

Submit score when game ends:
```javascript
useEffect(() => {
    if (gameState !== 'ended' || coresAwarded !== null) return
    tournamentService.eggHuntComplete(tournament.id, eggsCollected).then(data => {
        setCoresAwarded(data.coresAwarded)
        setPlaysRemaining(data.playsRemaining)
    }).catch(() => {
        setCoresAwarded(0)
    })
}, [gameState])
```

Egg collection handler:
```javascript
const handleEggCollected = useCallback(() => {
    if (gameState === 'ended') return
    setEggsCollected(prev => prev + 1)
    if (gameState === 'idle') {
        setGameState('active')
        setStartTime(Date.now())
        setTimeRemaining(120)
    }
}, [gameState])
```

Play again handler:
```javascript
const handlePlayAgain = useCallback(() => {
    setGameState('idle')
    setEggsCollected(0)
    setStartTime(null)
    setTimeRemaining(null)
    setCoresAwarded(null)
}, [])
```

- [ ] **Step 3: Update the JSX to conditionally render Easter elements**

Wrap the entire return in the Easter background div when `isEaster`:

The outer container becomes:
```jsx
<div className={isEaster ? 'easter-bg' : ''}>
```

Add canvas (always for Easter — bunny/chicks are decorative even when game is disabled) + HUD (only when game is available):
```jsx
{isEaster && (
    <Suspense fallback={null}>
        <EasterCanvas
            formRef={formRef}
            gameState={gameState}
            onEggCollected={handleEggCollected}
            enabled={gameActive}
        />
    </Suspense>
)}
{isEaster && gameActive && (
    <Suspense fallback={null}>
        <EasterHUD
            eggsCollected={eggsCollected}
            timeRemaining={timeRemaining}
            gameState={gameState}
            coresAwarded={coresAwarded}
            playsRemaining={playsRemaining}
            onPlayAgain={handlePlayAgain}
        />
    </Suspense>
)}
```

Where `gameActive` is a derived boolean:
```javascript
const gameActive = user && playsRemaining !== null && playsRemaining > 0
    && tournament?.status !== 'completed'
```

When `gameActive` is false, EasterCanvas still renders (bunny follows cursor, chicks wander) but `enabled=false` means eggs won't spawn and collection is disabled. When `tournament.status === 'completed'`, the visual ambiance remains but the HUD and game are hidden.

Add hedge banner before the form content:
```jsx
{isEaster && (
    <div className="easter-hedge-banner">
        <span className="easter-hedge-text" data-text={tournament.name}>
            {tournament.name}
        </span>
    </div>
)}
```

Add `ref={formRef}` to the form element. Add `easter-form-card` class to the form/info cards when `isEaster`. Add `easter-submit-btn` to the submit button when `isEaster`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TournamentSignup.jsx
git commit -m "feat(easter): integrate Easter theme into TournamentSignup"
```

---

### Task 8: Visual Testing + Polish

- [ ] **Step 1: Run dev server and test the page**

Run: `npm start`
Navigate to: `http://localhost:5173/tournaments/easter-invitational`

Verify:
- Grass background renders
- Hedge banner text shows with green gradient
- Canvas renders with bunny following cursor
- Chicks wander around
- Eggs visible on grass
- Bunny collects eggs on contact
- Counter increments
- Timer starts on first egg
- Game ends at 0:00
- Score shows with Cores award
- Play again works
- Form is styled with glassmorphism
- Normal tournament pages are unaffected

- [ ] **Step 2: Test edge cases**

- Not logged in: no game, just visuals + form login prompt
- All 5 plays used: game disabled, visuals still show
- Mobile: touch follows bunny
- Resize: canvas adjusts

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(easter): polish and finalize Easter Invitational page"
```

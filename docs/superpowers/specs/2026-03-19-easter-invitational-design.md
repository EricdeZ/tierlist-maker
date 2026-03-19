# Easter Invitational — Themed Tournament Page Design

## Overview

Transform the generic tournament signup page at `/tournaments/easter-invitational` into a fully Easter-themed experience with a top-down grass field, animated creatures, an egg hunt mini-game that awards Cores, and a polished signup form.

The theming is slug-gated: only `easter-invitational` gets the Easter treatment. All other tournament slugs render the existing page unchanged.

## Visual Layer

### Background
- Full-viewport seamless tileable grass texture image applied via `background-image: repeat` on the page container
- Source a free top-down grass tile asset, commit to `src/assets/easter/grass-tile.jpg` (static asset, simplest for a one-off themed page)
- CSS fallback if asset fails to load

### Canvas Overlay
- Transparent `<canvas>` element, position absolute, covers full page
- z-index 1 (behind form/HUD, in front of grass background)
- All animated elements rendered here via `requestAnimationFrame` loop

### Bunny (top-down, canvas-drawn)
- Simple oval body (white/light gray), two elongated ear ovals, small pink inner ears, dot eyes, cotton tail circle
- Faces toward cursor (rotates to point at cursor position)
- Smoothly interpolates position toward cursor with slight chase delay (lerp factor ~0.08)
- On mobile: follows touch position instead of cursor

### Chicks (top-down, canvas-drawn, 4–6 instances)
- Small yellow circle body, tiny orange beak triangle, dot eyes
- Randomized wander AI: pick random point → walk toward it → pause → pick another
- Purely decorative — no interaction with bunny or eggs

### Easter Eggs (canvas-drawn, 3–5 visible at a time)
- Colorful ovals with stripe patterns (canvas arcs, varied colors: pink, purple, blue, gold)
- Scattered on grass at random positions outside the form exclusion zone (canvas queries form element's `getBoundingClientRect()` to define exclusion rect)
- Collected when bunny overlaps (circle-circle collision, ~30px radius)
- On collection: fade-out animation, counter increments, new egg spawns at random valid position (min 100px from bunny, outside form zone)

### Hedge Banner (CSS/HTML, z-index 2)
- Tournament name rendered in large bold text
- Green hedge gradient (`linear-gradient` from bright green to dark green) with `-webkit-background-clip: text`
- Leaf dot texture overlay using `repeating-radial-gradient`
- Drop shadow for depth
- Full-width, sits at top of page above the form area
- Acts as visual separator / "wall" in the top-down garden theme

## Egg Hunt Mini-Game

### State Machine
1. **idle** — Eggs visible on grass, counter shows "0", no timer. Waiting for first collection.
2. **active** — First egg collected triggers 2-minute countdown. Counter increments on each collection. Eggs keep spawning.
3. **ended** — Timer hits 0. Bunny stops collecting. Score displayed. API call awards Cores. Show "Play Again" if plays remain, or "No plays remaining".

### HUD (HTML overlay, top right, z-index 2)
- Egg icon + count (always visible once game is idle/active)
- MM:SS countdown timer (appears on first collection)
- "+X Cores" with glow animation after game ends
- "X/5 hunts remaining" indicator

### Server Integration
**New endpoint:** `functions/api/tournament-egg-hunt.js`
- Wrapped with `adapt()` from `functions/lib/adapter.js`
- Uses `headers` (wildcard CORS) from `functions/lib/db.js` — this is a public auth-required endpoint, not admin
- Handles CORS preflight via `handleCors(event)` at top of handler
- **GET** (`action: 'status'`): Returns `{ playsUsed, playsRemaining }` for current user + tournament
- **POST** (`action: 'complete'`):
  - Auth: `requireAuth(event)` (must be logged in)
  - Body: `{ tournamentId, eggsCollected }`
  - Validates `tournamentId` resolves to a valid tournament (query by ID, confirm exists)
  - Validates `eggsCollected` is reasonable (server-side sanity cap: max 200)
  - Uses `transaction(event, async (sql) => { ... })` to atomically:
    1. Count existing plays for this user+tournament (`SELECT COUNT(*)`)
    2. Reject if >= 5
    3. Insert record into `tournament_egg_hunts`
    4. Call `grantEmber(sql, user.id, 'egg_hunt', eggsCollected, 'Easter egg hunt reward', eggHuntId)` from `functions/lib/ember.js`
  - Returns `{ coresAwarded, playsRemaining }`

**New table:** `tournament_egg_hunts` (migration `127-tournament-egg-hunts.sql`)
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

### Anti-Abuse
- Server-side play count enforcement (5 max per user per tournament) — inside `transaction()` to prevent race conditions
- Sanity cap on `eggsCollected` (max 200 — impossible to exceed in 2 minutes of normal play)
- Must be authenticated
- Rate limit: reject if last play was < 2 minutes ago (prevent rapid-fire submissions)
- `tournamentId` validated against database (must be a real tournament)

### Timer
- 2-minute countdown uses `Date.now()` wall-clock time (not frame-based) so it keeps counting even if the tab loses focus
- `startTime` recorded on first egg collection; each frame computes `elapsed = Date.now() - startTime`
- Game ends when elapsed >= 120000ms

### Game Availability
- Egg hunt is only active when the tournament status is `upcoming` or `in_progress`
- Once tournament is `completed`, the Easter visuals remain (grass, chicks, hedge banner) but the egg hunt game is disabled and the HUD is hidden

## Form Polish

### Card Container
- `bg-white/10 backdrop-blur-md` for semi-transparent glassmorphism over grass
- Soft pastel green/yellow border tint instead of `white/10`
- Larger border radius (`rounded-2xl`)

### Inputs
- More padding (`px-4 py-3`), larger border radius (`rounded-xl`)
- Focus ring in pastel green instead of generic accent
- Slightly warmer background (`bg-white/8`)

### Submit Button
- Pastel green gradient (`from-green-400 to-green-600`) with white text
- Hover: slight brightness increase

### Section Headers
- Small decorative leaf/egg icon accents next to "Tournament Dates", "Sign Up", etc.

## Page Layout (z-index stack)

| Layer | z-index | Content |
|-------|---------|---------|
| Grass background | 0 | Repeating tile image on container |
| Canvas | 1 | Bunny, chicks, eggs, animations |
| Hedge banner | 2 | CSS text at top |
| Form card | 2 | Centered, max-w-3xl, glassmorphism |
| HUD | 3 | Top-right egg counter, timer, plays |

## File Changes

| File | Change |
|------|--------|
| `src/pages/TournamentSignup.jsx` | Add `isEaster` slug check, render canvas + HUD + hedge banner conditionally, Easter form class overrides |
| `src/pages/tournament/EasterCanvas.jsx` | New — canvas game component (bunny, chicks, eggs, collision, animation loop) |
| `src/pages/tournament/EasterHUD.jsx` | New — egg counter, timer, score display, plays remaining |
| `src/pages/tournament/easter.css` | New — hedge banner styles, form polish overrides, HUD styling |
| `functions/api/tournament-egg-hunt.js` | New — `adapt()`-wrapped endpoint, `handleCors` + `headers` (wildcard), `requireAuth`, `transaction()` for atomic play count + award |
| `database/migrations/127-tournament-egg-hunts.sql` | New — `tournament_egg_hunts` table (user_id INTEGER) |
| `src/services/database.js` | Add `tournamentService.eggHuntStatus(tournamentId)` (GET) and `tournamentService.eggHuntComplete(tournamentId, eggsCollected)` (POST) |
| `src/assets/easter/grass-tile.jpg` | New — seamless tileable top-down grass texture |

## Responsive Behavior
- Canvas and game work on mobile via touch position tracking
- Chicks and eggs scale down slightly on smaller viewports
- HUD repositions for mobile (still top-right but smaller)
- Form card remains centered and responsive as it already is

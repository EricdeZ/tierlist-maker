# Trading Card Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `TradingCard` + `TradingCardHolo` into a single player-only `TradingCard` component with optional `holo` and `loadStats` flags.

**Architecture:** Extract shared holo spring physics into `useHoloEffect` hook. TradingCard becomes player-only, absorbs holo rendering when `holo` prop is truthy, fetches stats internally when `loadStats` prop is truthy. TradingCardHolo stays as a thin wrapper (using the same hook) for GameCard holo effects. Dead `PlayerCardContent` removed from GameCard.

**Tech Stack:** React 19, Vite 7, CSS container queries (cqi units)

**Spec:** `docs/superpowers/specs/2026-03-11-trading-card-unification-design.md`

---

## Chunk 1: Core Infrastructure

### Task 1: Extract `useHoloEffect` hook

Extract the spring physics and pointer interaction logic from `TradingCardHolo.jsx` into a reusable hook.

**Files:**
- Create: `src/hooks/useHoloEffect.js`

- [ ] **Step 1: Create the hook file**

Extract `useSpring`, `clamp`, `round`, `adjust`, and the interaction logic from `src/components/TradingCardHolo.jsx` (lines 1-91 for useSpring, lines 93-178 for interaction logic).

```js
// src/hooks/useHoloEffect.js
import { useRef, useCallback, useEffect, useState } from 'react'

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max)
const round = (value, precision = 3) => parseFloat(value.toFixed(precision))
const adjust = (value, fromMin, fromMax, toMin, toMax) =>
    round(toMin + (toMax - toMin) * (value - fromMin) / (fromMax - fromMin))

function useSpring(initial, { stiffness = 0.066, damping = 0.25 } = {}) {
    // ... exact copy of lines 10-91 from TradingCardHolo.jsx
    // (useSpring is entirely self-contained, copy verbatim)
}

export function useHoloEffect() {
    const cardRef = useRef(null)
    const endTimerRef = useRef(null)
    const [interacting, setInteracting] = useState(false)
    const [active, setActive] = useState(false)

    const [rotate, setRotate] = useSpring({ x: 0, y: 0 }, { stiffness: 0.066, damping: 0.25 })
    const [glare, setGlare] = useSpring({ x: 50, y: 50, o: 0 }, { stiffness: 0.066, damping: 0.25 })
    const [bg, setBg] = useSpring({ x: 50, y: 50 }, { stiffness: 0.066, damping: 0.25 })

    useEffect(() => {
        return () => clearTimeout(endTimerRef.current)
    }, [])

    const interact = useCallback((e) => {
        clearTimeout(endTimerRef.current)
        setInteracting(true)
        let clientX, clientY
        if (e.touches) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }
        const rect = cardRef.current.getBoundingClientRect()
        const absolute = { x: clientX - rect.left, y: clientY - rect.top }
        const percent = {
            x: clamp(round((100 / rect.width) * absolute.x)),
            y: clamp(round((100 / rect.height) * absolute.y)),
        }
        const center = { x: percent.x - 50, y: percent.y - 50 }
        setBg({ x: adjust(percent.x, 0, 100, 37, 63), y: adjust(percent.y, 0, 100, 33, 67) }, { stiffness: 0.066, damping: 0.25 })
        setRotate({ x: round(-(center.x / 3.5)), y: round(center.y / 2) }, { stiffness: 0.066, damping: 0.25 })
        setGlare({ x: round(percent.x), y: round(percent.y), o: 1 }, { stiffness: 0.066, damping: 0.25 })
    }, [setBg, setRotate, setGlare])

    const interactEnd = useCallback(() => {
        clearTimeout(endTimerRef.current)
        endTimerRef.current = setTimeout(() => {
            setInteracting(false)
            setRotate({ x: 0, y: 0 }, { stiffness: 0.01, damping: 0.06 })
            setGlare({ x: 50, y: 50, o: 0 }, { stiffness: 0.01, damping: 0.06 })
            setBg({ x: 50, y: 50 }, { stiffness: 0.01, damping: 0.06 })
        }, 300)
    }, [setRotate, setGlare, setBg])

    const pointerFromCenter = clamp(
        Math.sqrt(((glare.y ?? 50) - 50) ** 2 + ((glare.x ?? 50) - 50) ** 2) / 50, 0, 1
    )

    const dynamicStyles = {
        '--pointer-x': `${glare.x ?? 50}%`,
        '--pointer-y': `${glare.y ?? 50}%`,
        '--pointer-from-center': pointerFromCenter,
        '--pointer-from-top': (glare.y ?? 50) / 100,
        '--pointer-from-left': (glare.x ?? 50) / 100,
        '--card-opacity': glare.o ?? 0,
        '--rotate-x': `${(rotate.x ?? 0)}deg`,
        '--rotate-y': `${(rotate.y ?? 0)}deg`,
        '--background-x': `${bg.x ?? 50}%`,
        '--background-y': `${bg.y ?? 50}%`,
    }

    const handlers = {
        onPointerMove: interact,
        onMouseLeave: interactEnd,
        onTouchMove: interact,
        onTouchEnd: interactEnd,
        onClick: () => setActive(a => !a),
    }

    return { cardRef, dynamicStyles, interacting, active, handlers }
}
```

- [ ] **Step 2: Verify app still builds**

Run: `npm run build`
Expected: Success (new file has no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHoloEffect.js
git commit -m "refactor: extract useHoloEffect hook from TradingCardHolo"
```

---

### Task 2: Refactor `TradingCardHolo` to use `useHoloEffect`

Replace the inline spring/interaction logic in `TradingCardHolo.jsx` with the new hook. This validates the hook works before TradingCard uses it.

**Files:**
- Modify: `src/components/TradingCardHolo.jsx` (lines 1-208 — full rewrite to thin wrapper)

- [ ] **Step 1: Rewrite TradingCardHolo to use the hook**

Replace the entire file content. Remove `useSpring`, `clamp`, `round`, `adjust`, and all interaction logic. Keep only the JSX shell that renders the holo DOM structure.

```jsx
// src/components/TradingCardHolo.jsx
import { useHoloEffect } from '../hooks/useHoloEffect'
import './TradingCardHolo.css'

export default function TradingCardHolo({ children, rarity = 'holo', role = 'ADC', holoType = 'full', size }) {
    const { cardRef, dynamicStyles, interacting, active, handlers } = useHoloEffect()
    const roleClass = (role || 'adc').toLowerCase()

    return (
        <div
            className={`holo-card ${roleClass} ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-rarity={rarity}
            data-holo-type={holoType}
            style={{ ...dynamicStyles, ...(size ? { width: size, '--card-scale': size / 340 } : {}) }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...handlers}>
                    <div className="holo-card__front">
                        {children}
                        <div className="holo-card__shine" />
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Verify the app builds and holo effects still work**

Run: `npm run build`
Expected: Success. All existing `<TradingCardHolo>` consumers (GameCard wrapping in CardZoomModal, PackOpening, StartingFive, CardCatalog) should work identically.

- [ ] **Step 3: Commit**

```bash
git add src/components/TradingCardHolo.jsx
git commit -m "refactor: TradingCardHolo uses shared useHoloEffect hook"
```

---

### Task 3: Add `resolvePlayerImage` to `playerAvatar.js`

**Files:**
- Modify: `src/utils/playerAvatar.js` (append after line 27)

- [ ] **Step 1: Add the function**

Append to `src/utils/playerAvatar.js`:

```js
/**
 * Resolve initial image source for a player card.
 * Priority: avatarUrl → god card art (if connected) → null (triggers passionless/initials)
 */
export function resolvePlayerImage({ avatarUrl, bestGodName, isConnected }) {
    if (avatarUrl) return { src: avatarUrl, isGodImage: false }
    if (bestGodName && isConnected !== false) return { src: getGodCardUrl(bestGodName), isGodImage: true }
    return { src: null, isGodImage: false }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/playerAvatar.js
git commit -m "feat: add resolvePlayerImage utility for centralized image fallback"
```

---

### Task 4: Rewrite `TradingCard` — player-only, `holo` prop, `loadStats` prop

This is the core task. Rewrite `TradingCard.jsx` to:
1. Remove `variant` prop and non-player layout branch (lines 108-128)
2. Remove `level`, `power` props (unused in player variant)
3. Use `resolvePlayerImage` for initial image state
4. Add `holo` prop — when truthy `{ rarity, holoType }`, render holo wrapper DOM using `useHoloEffect`
5. Add `loadStats` prop — when truthy (a `defId`), fetch stats from API on mount
6. Always render player layout (always `trading-card--player` class)
7. Stats section only renders when `stats` is truthy (not when empty/null)

**Files:**
- Modify: `src/components/TradingCard.jsx` (full rewrite)

- [ ] **Step 1: Rewrite TradingCard.jsx**

```jsx
import { useState, useEffect } from 'react'
import './TradingCard.css'
import './TradingCardHolo.css'

import passiontailsImg from '../assets/passion/passiontails.png'
import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'
import { resolvePlayerImage, getGodCardUrl } from '../utils/playerAvatar'
import { useHoloEffect } from '../hooks/useHoloEffect'

const ROLE_IMAGES = {
    'SOLO': soloImage, 'JUNGLE': jungleImage, 'MID': midImage,
    'SUPPORT': suppImage, 'ADC': adcImage,
}

const normalizeRole = (role) => {
    if (!role) return 'ADC'
    const upper = role.toUpperCase()
    if (upper === 'SUPP') return 'SUPPORT'
    if (ROLE_IMAGES[upper]) return upper
    return 'ADC'
}

const fmt = (num) => {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    return Math.round(num).toLocaleString()
}

const ROLE_STATS = {
    'SOLO': 'mitigated', 'SUPPORT': 'mitigated',
    'JUNGLE': 'damage', 'MID': 'damage', 'ADC': 'damage',
}

export default function TradingCard({
    playerName,
    teamName,
    teamColor,
    seasonName,
    role,
    avatarUrl,
    stats: statsProp,
    bestGod: bestGodProp,
    leagueName,
    divisionName,
    rarity,
    isConnected: isConnectedProp,
    isFirstEdition,
    size,
    // New flags
    holo,       // falsy = flat card, { rarity, holoType } = holo effect
    loadStats,  // falsy = no fetch, defId value = fetch stats from API
}) {
    const normalizedRole = normalizeRole(role)
    const roleImg = ROLE_IMAGES[normalizedRole]

    // --- loadStats: fetch from API when defId provided ---
    const [fetchedData, setFetchedData] = useState(null)
    const [loadingStats, setLoadingStats] = useState(!!loadStats)

    useEffect(() => {
        if (!loadStats) return
        setLoadingStats(true)
        // Dynamic import to avoid coupling when loadStats is not used
        import('../services/database').then(({ vaultService }) =>
            vaultService.getCardDetail(loadStats)
        ).then(data => {
            setFetchedData(data)
        }).catch(err => {
            console.error('Failed to load card stats:', err)
        }).finally(() => setLoadingStats(false))
    }, [loadStats])

    // Merge fetched data over props
    const stats = fetchedData?.stats || statsProp || null
    const bestGod = fetchedData?.bestGod || bestGodProp
        || (fetchedData?.bestGodName ? { name: fetchedData.bestGodName } : null)
    const seasonNameFinal = fetchedData?.seasonName || seasonName
    const isConnected = fetchedData?.isConnected !== undefined ? fetchedData.isConnected : isConnectedProp

    // --- Image fallback chain ---
    const initial = resolvePlayerImage({ avatarUrl, bestGodName: bestGod?.name, isConnected })
    const [imgSrc, setImgSrc] = useState(initial.src)
    const [imgFailed, setImgFailed] = useState(false)
    const [isGodImage, setIsGodImage] = useState(initial.isGodImage)

    useEffect(() => {
        const next = resolvePlayerImage({ avatarUrl, bestGodName: bestGod?.name, isConnected })
        setImgSrc(next.src)
        setImgFailed(false)
        setIsGodImage(next.isGodImage)
    }, [avatarUrl, bestGod?.name, isConnected])

    const handleImgError = () => {
        const godUrl = bestGod?.name && isConnected !== false ? getGodCardUrl(bestGod.name) : null
        if (imgSrc === avatarUrl && godUrl && imgSrc !== godUrl) {
            setImgSrc(godUrl)
            setIsGodImage(true)
        } else {
            setImgFailed(true)
        }
    }

    // --- Holo effect (conditional) ---
    const holoEffect = useHoloEffect()

    // --- Render card content ---
    const cardContent = (
        <div
            className="trading-card trading-card--player"
            data-role={normalizedRole}
            data-rarity={rarity || undefined}
            style={!holo && size ? { width: size, '--card-scale': size / 340 } : undefined}
        >
            <div className="card-border">
                <div className="card-body">
                    {/* Top banner: name + role */}
                    <div className="card-top-banner">
                        <div className="card-top-left">
                            <span className="card-name">{playerName}</span>
                            {isFirstEdition && <span className="card-edition-badge">1st Edition</span>}
                        </div>
                        <div className="card-top-right">
                            <span className="card-stage-label">{normalizedRole}</span>
                            <div className="card-emblem card-emblem--sm">
                                <img src={roleImg} alt={normalizedRole} />
                            </div>
                        </div>
                    </div>

                    {/* Image frame */}
                    <div className="card-image-wrap">
                        <div className="card-image-frame">
                            {isConnected === false && !imgSrc ? (
                                <div className="card-image-placeholder" style={{ position: 'relative' }}>
                                    <img src={passiontailsImg} alt="Passionless" style={{ width: '100%', height: '100%', opacity: 0.5, objectFit: 'contain' }} />
                                    <span style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, fontSize: '10px', fontWeight: 700, color: 'var(--text-dim, #9a8a70)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.3 }}>
                                        Passionless<br />Not Connected
                                    </span>
                                </div>
                            ) : imgSrc && !imgFailed ? (
                                <img
                                    src={imgSrc}
                                    alt={playerName}
                                    style={isGodImage ? { objectPosition: 'center 20%' } : undefined}
                                    onError={handleImgError}
                                />
                            ) : (
                                <div className="card-image-placeholder">
                                    <span className="card-image-initials" style={{ color: teamColor || 'var(--accent)' }}>
                                        {(playerName || '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="card-corner card-corner-tl" />
                        <div className="card-corner card-corner-tr" />
                        <div className="card-corner card-corner-bl" />
                        <div className="card-corner card-corner-br" />
                    </div>

                    {/* Team / Season info */}
                    <div className="card-info-bar">
                        <span className="card-info-text">
                            {[teamName, leagueName, divisionName].filter(Boolean).join(' \u00b7 ')}
                        </span>
                    </div>

                    {/* Stats section — only when stats provided or fetched */}
                    {stats && (
                        <div className="card-stats-section">
                            <div className="card-stats-grid">
                                <div className="card-stat-row">
                                    <div className="card-stat-energy">
                                        <div className="card-energy-circle"><img src={roleImg} alt="" /></div>
                                    </div>
                                    <div className="card-stat-info">
                                        <span className="card-stat-name">KDA Strike</span>
                                        <span className="card-stat-sub">{stats.gamesPlayed ? `${stats.totalKills}/${stats.totalDeaths}/${stats.totalAssists}` : '\u2014/\u2014/\u2014'}</span>
                                    </div>
                                    <span className="card-stat-value">{stats.gamesPlayed ? stats.kda?.toFixed(1) : '\u2014'}</span>
                                </div>
                                {ROLE_STATS[normalizedRole] === 'damage' && (
                                    <div className="card-stat-row">
                                        <div className="card-stat-energy">
                                            <div className="card-energy-circle"><img src={roleImg} alt="" /></div>
                                            <div className="card-energy-circle"><img src={roleImg} alt="" /></div>
                                        </div>
                                        <div className="card-stat-info">
                                            <span className="card-stat-name">Damage</span>
                                            <span className="card-stat-sub">Avg per game</span>
                                        </div>
                                        <span className="card-stat-value">{stats.gamesPlayed ? fmt(stats.avgDamage || 0) : '\u2014'}</span>
                                    </div>
                                )}
                                {ROLE_STATS[normalizedRole] === 'mitigated' && (
                                    <div className="card-stat-row">
                                        <div className="card-stat-energy">
                                            <div className="card-energy-circle"><img src={roleImg} alt="" /></div>
                                            <div className="card-energy-circle"><img src={roleImg} alt="" /></div>
                                        </div>
                                        <div className="card-stat-info">
                                            <span className="card-stat-name">Mitigated</span>
                                            <span className="card-stat-sub">Avg per game</span>
                                        </div>
                                        <span className="card-stat-value">{stats.gamesPlayed ? fmt(stats.avgMitigated || 0) : '\u2014'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="card-record-bar">
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed ? `${stats.winRate?.toFixed(0)}%` : '\u2014'}</span>
                                    <span className="card-record-label">WR</span>
                                </div>
                                <div className="card-record-divider" />
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed ? `${stats.wins || 0}W-${(stats.gamesPlayed || 0) - (stats.wins || 0)}L` : '\u2014'}</span>
                                    <span className="card-record-label">Record</span>
                                </div>
                                <div className="card-record-divider" />
                                <div className="card-record-item">
                                    <span className="card-record-val">{stats.gamesPlayed || '\u2014'}</span>
                                    <span className="card-record-label">Games</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Flavor text */}
                    <div className="card-flavor">
                        {bestGod?.imageUrl && (
                            <img src={bestGod.imageUrl} alt={bestGod.name} className="card-flavor-img" />
                        )}
                        <span className="card-flavor-text">
                            {bestGod
                                ? bestGod.games != null
                                    ? `${playerName}'s most played god is ${bestGod.name} with ${bestGod.games} game${bestGod.games !== 1 ? 's' : ''} and a ${bestGod.winRate?.toFixed(0)}% win rate.`
                                    : `${playerName}'s most played god is ${bestGod.name}.`
                                : 'No games recorded this season.'
                            }
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="card-footer">
                        <div className="card-footer-left">
                            <img src={roleImg} alt="" className="card-footer-icon" />
                            <span>{teamName || 'Free Agent'}</span>
                        </div>
                        <span className="card-footer-set">{seasonNameFinal}</span>
                    </div>
                </div>
            </div>

            {/* Loading overlay for loadStats */}
            {loadingStats && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
                    <div className="cd-spinner w-8 h-8" />
                </div>
            )}
        </div>
    )

    // --- Holo wrapper (conditional) ---
    if (!holo) return cardContent

    const roleClass = normalizedRole.toLowerCase()
    return (
        <div
            className={`holo-card ${roleClass} ${holoEffect.interacting ? 'interacting' : ''} ${holoEffect.active ? 'active' : ''}`}
            data-rarity={holo.rarity}
            data-holo-type={holo.holoType || 'full'}
            style={{ ...holoEffect.dynamicStyles, ...(size ? { width: size, '--card-scale': size / 340 } : {}) }}
            ref={holoEffect.cardRef}
        >
            <div className="holo-card__translater">
                <div className="holo-card__rotator" {...holoEffect.handlers}>
                    <div className="holo-card__front">
                        {cardContent}
                        <div className="holo-card__shine" />
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
```

**Key changes from current code:**
- Removed `variant` prop — always renders player layout
- Removed `level`, `power` props — unused
- Removed non-player branch (old lines 108-128)
- Image fallback uses `resolvePlayerImage` for initial computation
- `stats` section only renders when `stats` is truthy (not when `EMPTY_STATS` is passed)
- `loadStats` prop triggers internal API fetch via dynamic import
- `holo` prop wraps card in holo DOM structure using `useHoloEffect`
- Info bar always uses `[teamName, leagueName, divisionName]` format (removed non-player `[teamName, seasonName]` branch)
- Initials fallback always renders (removed non-player role icon fallback)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build may fail due to consumers still passing `variant="player"` — that's fine, this gets fixed in Chunk 2. Check for import errors only.

- [ ] **Step 3: Commit**

```bash
git add src/components/TradingCard.jsx
git commit -m "feat: TradingCard unified with holo + loadStats flags, player-only"
```

---

### Task 5: Clean up `TradingCard.css`

Remove styles for the non-player layout that no longer exists.

**Files:**
- Modify: `src/components/TradingCard.css`

- [ ] **Step 1: Remove non-player styles**

Remove these CSS rules (they were for the non-player layout branch):
- `.card-name-bar` (lines 189-194) — was the centered name bar below emblem
- `.card-emblem` (lines 167-177) — the large centered emblem (keep `.card-emblem--sm`)
- `.card-emblem img` (lines 179-184) — large emblem image styles
- `.card-hp-label` (lines 151-156)
- `.card-hp-value` (lines 158-164)

**Keep** all `.trading-card--player` override styles — they become the base behavior now but the selectors still work.

- [ ] **Step 2: Commit**

```bash
git add src/components/TradingCard.css
git commit -m "refactor: remove non-player card CSS (player-only now)"
```

---

### Task 6: Remove `PlayerCardContent` from `GameCard.jsx`

**Files:**
- Modify: `src/pages/vault/components/GameCard.jsx` (lines 47, 260-302)

- [ ] **Step 1: Remove the player type**

1. Delete the `type === 'player'` branch on line 47
2. Delete the entire `PlayerCardContent` function (lines 260-302)
3. In the `GameCard` function, remove `|| type === 'player'` from the role computation on line 29:
   - Before: `const role = (type === 'god' || type === 'player') ? ...`
   - After: `const role = type === 'god' ? ...`

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/components/GameCard.jsx
git commit -m "refactor: remove dead PlayerCardContent from GameCard"
```

---

## Chunk 2: Update Vault Consumers

Every consumer needs these changes:
- Remove `variant="player"` prop (no longer needed)
- Remove manual `TradingCardHolo` wrapping for player cards → use `holo` prop
- Remove `TradingCardHolo` import if no longer used (still needed for GameCard holo wrapping)
- Pass `loadStats={defId}` where stats should be fetched
- Don't pass `EMPTY_STATS` — omit `stats` prop when no stats available (card will render without stats section)

### Task 7: Update `CardZoomModal`

The biggest consumer change. Remove the internal stats fetch (TradingCard handles it via `loadStats`). Remove TradingCardHolo wrapping for player cards.

**Files:**
- Modify: `src/pages/vault/components/CardZoomModal.jsx`

- [ ] **Step 1: Simplify the player card rendering**

Remove:
- `const [stats, setStats]` state (line 27)
- `const [bestGod, setBestGod]` state (line 28)
- `const [bestGodName, setBestGodName]` state (line 29)
- `const [seasonName, setSeasonName]` state (line 30)
- `const [isConnected, setIsConnected]` state (line 31)
- `const [loadingStats, setLoadingStats]` state (line 32)
- The entire `useEffect` that fetches stats (lines 62-74)
- The `EMPTY_STATS` constant (lines 12-16)
- The `import TradingCardHolo` (line 6) — **only if no GameCard holo wrapping remains**. Check: GameCard is still wrapped in `TradingCardHolo` on line 156-162, so **keep the import**.

Replace the player card rendering block (lines 165-193) with:

```jsx
{playerCard && (
    <TradingCard
        playerName={playerCard.playerName}
        teamName={playerCard.teamName}
        teamColor={playerCard.teamColor}
        role={playerCard.role}
        avatarUrl={playerCard.avatarUrl}
        rarity={rarity}
        leagueName={playerCard.leagueName}
        divisionName={playerCard.divisionName}
        seasonName={playerCard.seasonName}
        bestGod={playerCard.bestGod}
        isConnected={playerCard.isConnected}
        isFirstEdition={playerCard.isFirstEdition}
        loadStats={playerCard.defId}
        holo={{ rarity: holoEffect, holoType }}
    />
)}
```

Note: `holoEffect` and `holoType` are already computed on lines 131 and 135. `role` for holo is now derived internally by TradingCard.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/components/CardZoomModal.jsx
git commit -m "refactor: CardZoomModal uses TradingCard holo+loadStats flags"
```

---

### Task 8: Update `CCStartingFive`

Fix the zoom bug (missing defId, wrong bestGod shape) and switch to new TradingCard API.

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

- [ ] **Step 1: Update `toPlayerCardProps` (lines 45-58)**

Add `defId` and `isConnected`. Remove `stats: EMPTY_STATS`.

```js
function toPlayerCardProps(card) {
    const cd = card.cardData || {}
    return {
        playerName: card.godName,
        teamName: cd.teamName || '',
        teamColor: cd.teamColor || '#6366f1',
        role: cd.role || card.role || 'ADC',
        avatarUrl: card.imageUrl || '',
        leagueName: cd.leagueName || '',
        divisionName: cd.divisionName || '',
        seasonName: cd.seasonName || '',
        bestGod: cd.bestGod
            ? { ...cd.bestGod, ...(card.bestGodName ? { name: card.bestGodName } : {}) }
            : (card.bestGodName ? { name: card.bestGodName } : null),
        isFirstEdition: card.isFirstEdition || false,
        isConnected: cd.isConnected,
        defId: card.defId,
    }
}
```

- [ ] **Step 2: Update FilledSlot rendering (lines 810-821)**

Replace the TradingCardHolo wrapping for player cards:

Before:
```jsx
<TradingCardHolo rarity={getHoloEffect(card.rarity)} role={...} holoType={card.holoType || 'reverse'} size={size}>
    {isPlayer ? (
        <TradingCard {...toPlayerCardProps(card)} variant="player" rarity={card.rarity} size={size} />
    ) : (
        <GameCard ... />
    )}
</TradingCardHolo>
```

After:
```jsx
{isPlayer ? (
    <TradingCard
        {...toPlayerCardProps(card)}
        rarity={card.rarity}
        size={size}
        holo={{ rarity: getHoloEffect(card.rarity), holoType: card.holoType || 'reverse' }}
    />
) : (
    <TradingCardHolo rarity={getHoloEffect(card.rarity)} role={(card.role || card.cardData?.role || 'adc').toUpperCase()} holoType={card.holoType || 'reverse'} size={size}>
        <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={size} />
    </TradingCardHolo>
)}
```

- [ ] **Step 3: Update zoom modal call (line 558)**

The `toPlayerCardProps` now includes `defId`, `isConnected`, and `bestGod` (object). CardZoomModal's TradingCard will use `loadStats={playerCard.defId}` and `bestGod={playerCard.bestGod}` correctly.

No change needed to line 558 — `toPlayerCardProps(zoomedCard)` already passes the right shape now.

- [ ] **Step 4: Update PickerCard rendering** (find in file — uses `TradingCard` with `variant="player"`)

Remove `variant="player"` from all TradingCard usages. Remove `stats: EMPTY_STATS` if passed.

- [ ] **Step 5: Remove `EMPTY_STATS` constant** if no longer used.

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "fix: StartingFive zoom now loads stats and shows correct image"
```

---

### Task 9: Update `CCBinder`

**Files:**
- Modify: `src/pages/vault/CCBinder.jsx`

- [ ] **Step 1: Update imports and helpers**

Remove `EMPTY_STATS` constant (lines 586-590). In `toPlayerCardProps` (lines 605-617): remove `stats: EMPTY_STATS`, add `defId: card.defId`, `isConnected: card.cardData?.isConnected`.

- [ ] **Step 2: Update `BinderCardRender` (lines 619-625)**

Remove `variant="player"`:

```jsx
function BinderCardRender({ card }) {
    const isPlayer = (card.cardType || 'god') === 'player'
    if (isPlayer) {
        return <TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} />
    }
    return <GameCard type={card.cardType || 'god'} rarity={card.rarity} data={toGameCardData(card)} />
}
```

- [ ] **Step 3: Update `CardPicker` rendering (line 573)**

Remove `variant="player"`:
```jsx
<TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={130} />
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/CCBinder.jsx
git commit -m "refactor: CCBinder uses unified TradingCard API"
```

---

### Task 10: Update `PackOpening`

**Files:**
- Modify: `src/pages/vault/components/PackOpening.jsx`

- [ ] **Step 1: Update the `PackCard` helper function (lines 75-105)**

Replace TradingCardHolo wrapping of player cards with `holo` prop. Replace `variant="player"` removal.

For player cards with holo:
```jsx
<TradingCard
    {...toPlayerCardProps(card)}
    rarity={card.rarity}
    size={size}
    holo={{ rarity: holoEffect, holoType: card.holoType || 'reverse' }}
/>
```

For player cards without holo:
```jsx
<TradingCard {...toPlayerCardProps(card)} rarity={card.rarity} size={size} />
```

Keep `TradingCardHolo` import for GameCard holo wrapping.

- [ ] **Step 2: Update `toPlayerCardProps`** — remove `EMPTY_STATS`, remove `variant`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/components/PackOpening.jsx
git commit -m "refactor: PackOpening uses unified TradingCard holo prop"
```

---

### Task 11: Update remaining vault pages (batch)

These all follow the same pattern: remove `variant="player"`, remove manual TradingCardHolo wrapping for player cards, remove `EMPTY_STATS` where passed, add `defId` to zoom handlers.

**Files:**
- Modify: `src/pages/vault/CCCollection.jsx`
- Modify: `src/pages/vault/CCDismantle.jsx`
- Modify: `src/pages/vault/CCMarketplace.jsx`
- Modify: `src/pages/vault/CCTrading.jsx`
- Modify: `src/pages/vault/CCPlayerCards.jsx`
- Modify: `src/pages/vault/CCCardCatalog.jsx`

- [ ] **Step 1: CCCollection.jsx**

The zoom handler (line ~856) already passes `defId` and `bestGodName`. Update the inline `TradingCard` rendering (line ~875) to remove `variant="player"`. Change `stats={EMPTY_STATS}` to omit `stats` entirely.

- [ ] **Step 2: CCDismantle.jsx**

Update `toPlayerCardProps` helper: remove `stats: EMPTY_STATS`, remove `variant="player"` from TradingCard render (line ~358).

- [ ] **Step 3: CCMarketplace.jsx**

Update zoom handler `handleCardZoom` (line ~231): add `bestGodName`, `isConnected` to playerCard object. Update inline TradingCard rendering (line ~59): remove `variant="player"`, remove `stats={EMPTY_STATS}`.

- [ ] **Step 4: CCTrading.jsx**

Update zoom handler `handleZoomCard` (line ~702): add `bestGodName` from `cd`. Update TradingCard rendering: remove `variant="player"`.

- [ ] **Step 5: CCPlayerCards.jsx**

Replace TradingCardHolo wrapping (line ~187):
```jsx
// Before:
<TradingCardHolo rarity={holoEffect} role={cardProps.role} holoType="reverse" size={240}>
    <TradingCard {...cardProps} variant="player" rarity={rarity} />
</TradingCardHolo>

// After:
<TradingCard {...cardProps} rarity={rarity} size={240} holo={{ rarity: holoEffect, holoType: 'reverse' }} />
```
Remove `TradingCardHolo` import.

- [ ] **Step 6: CCCardCatalog.jsx**

Remove TradingCardHolo wrapping for player cards (if any). Currently only zooms GameCards — just remove `variant` from any TradingCard if present. Keep TradingCardHolo import for GameCard wrapping.

- [ ] **Step 7: Commit**

```bash
git add src/pages/vault/CCCollection.jsx src/pages/vault/CCDismantle.jsx src/pages/vault/CCMarketplace.jsx src/pages/vault/CCTrading.jsx src/pages/vault/CCPlayerCards.jsx src/pages/vault/CCCardCatalog.jsx
git commit -m "refactor: vault pages use unified TradingCard API"
```

---

## Chunk 3: Share Pages + Admin

### Task 12: Update share pages

**Files:**
- Modify: `src/pages/vault/CardSharePage.jsx`
- Modify: `src/pages/vault/BinderSharePage.jsx`

- [ ] **Step 1: CardSharePage.jsx**

Replace TradingCardHolo wrapping (line ~71):
```jsx
// Before:
<TradingCardHolo rarity={holoEffect} role={card.role} holoType={holoType || 'reverse'}>
    <TradingCard {...card} variant="player" rarity={rarity} />
</TradingCardHolo>

// After:
<TradingCard {...card} rarity={rarity} holo={{ rarity: holoEffect, holoType: holoType || 'reverse' }} />
```
Remove `TradingCardHolo` import.

- [ ] **Step 2: BinderSharePage.jsx**

Update `toPlayerCardProps`: remove `stats: EMPTY_STATS`. Update `ShareCardRender`: remove `variant="player"`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/CardSharePage.jsx src/pages/vault/BinderSharePage.jsx
git commit -m "refactor: share pages use unified TradingCard API"
```

---

### Task 13: Update admin pages

**Files:**
- Modify: `src/pages/admin/CardPreview.jsx`
- Modify: `src/pages/admin/vault/CCAdminShare.jsx`

- [ ] **Step 1: CardPreview.jsx**

Replace all TradingCardHolo wrapping with `holo` prop. Update `makeSampleCard` to include `variant` removal. Since TradingCard is now player-only, all sample cards render as players (which is what CardPreview was showing anyway — player cards with sample stats).

Remove `TradingCardHolo` import.

- [ ] **Step 2: CCAdminShare.jsx**

Replace TradingCardHolo wrapping (line ~230):
```jsx
// Before:
<TradingCardHolo rarity={holoEffect} role={cardProps.role} holoType="reverse">
    <TradingCard {...cardProps} variant="player" rarity={rarity} />
</TradingCardHolo>

// After:
<TradingCard {...cardProps} rarity={rarity} holo={{ rarity: holoEffect, holoType: 'reverse' }} />
```
Remove `TradingCardHolo` import.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/CardPreview.jsx src/pages/admin/vault/CCAdminShare.jsx
git commit -m "refactor: admin pages use unified TradingCard API"
```

---

### Task 14: Final verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Success with no errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 3: Search for stale references**

Search for any remaining `variant="player"` or `variant: 'player'` — should find zero results.
Search for any remaining manual `<TradingCardHolo>` wrapping of `<TradingCard>` — should find zero results.
Search for `EMPTY_STATS` in vault files — should only exist if still used for non-TradingCard purposes.

- [ ] **Step 4: Verify no orphaned imports**

Search for `import TradingCardHolo` — should only appear in files that still wrap GameCard.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: clean up stale references after TradingCard unification"
```

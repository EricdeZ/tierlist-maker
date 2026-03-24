# Homepage League Section Redesign

## Overview

Redesign the "Choose Your League" section on the homepage. Replace the current layout (league headers with inline division grids + hardcoded promo banners) with a clean card-based design grouped by status. No divisions shown on this screen.

## Data Available Per League

From the API (`leagueService.getAll()` + `leagueService.getBySlug()`):

- `name` — league display name
- `slug` — URL slug
- `color` — hex color (e.g. `#F57C20`), nullable
- `slogan` — short tagline, nullable
- `image_url` — logo URL, nullable (fallback to static asset via `getLeagueLogo()`)
- `discord_url` — Discord invite link, nullable
- `league_tags` — array of string tags (e.g. "5v5", "Conquest")
- `divisions` — array with nested `seasons` (used only to determine active status)

## Status Classification

Leagues are sorted into three groups:

| Status | Condition | Button |
|--------|-----------|--------|
| **Live** | Has any division with an active season | "View" → `/:leagueSlug` |
| **Open for Signups** | Slug exists in `SIGNUP_ROUTES` map (`agl` → `/agl/signup`, `sal` → `/sal/signup`) | "Sign Up" → signup route |
| **Not Active** | Neither live nor signup | No button, card is dimmed |

A league can be both Live and Signup — in that case, show it in **Signup** (signup takes priority since it's time-sensitive). Display order: Live → Signup → Not Active. Empty groups are hidden.

## Layout

### Section Header

```
[colored dot] STATUS LABEL                    N leagues
─────────────────────────────────────────────────────
```

- Small colored dot (green for Live, league-colored for Signup, gray for Not Active)
- Uppercase label, muted color, wide letter-spacing
- League count on the right
- Thin separator line below

### Card Grid

- `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Gap: 1rem
- Responsive: 4-5 cards per row on desktop, 2 on tablet, 1 on mobile

### Card Design (Vertical)

```
┌──────────────────────┐
│   [3px color bar]    │  ← league color gradient, fades right
│                      │
│      (logo 72px)     │  ← no background, no border on logo
│                      │
│    League Name       │  ← bold, white, centered
│  Optional slogan     │  ← small, muted, centered
│                      │
│     [ Button ]       │  ← pinned to bottom via flex
└──────────────────────┘
```

**Card container:**
- `border-radius: 1rem`
- Background: `rgba(255,255,255,0.03)`
- Border: `1px solid rgba(255,255,255,0.08)`
- Hover: lift (-3px), brighter border, shadow
- Flex column, centered, `text-align: center`
- Padding: `1.5rem 1.25rem`

**Accent bar:** 3px tall at the top, `linear-gradient(90deg, {leagueColor}, transparent)`

**Background glow:** Subtle radial gradient of the league color behind the logo area, ~7% opacity

**Logo:** 72px, `object-contain`, no background, no border frame. Fallback: Trophy icon colored with league color.

**Name:** ~1rem, font-weight 800, white

**Slogan:** ~0.75rem, `rgba(255,255,255,0.4)`, only rendered if present

**Button styles:**
- "View" (live): pill shape, subtle glass background (`rgba(255,255,255,0.06)`), white text, no border. Hover: slight brighten.
- "Sign Up" (signup): pill shape, filled with the league's color, white text, slight shadow. Hover: brightness bump.
- Both: `padding: 0.5rem 1.5rem`, `border-radius: 9999px`, `font-weight: 600`, `font-size: 0.8rem`, arrow `→` suffix.

**Inactive cards:** `opacity: 0.4`, no hover effects, no button.

## What Gets Removed

- `AGLPromoBanner` component (hardcoded AGL promo)
- `SALPromoBanner` component (hardcoded SAL promo)
- `DivisionCard` component (division grid within league)
- `LeagueHeader` component (replaced by the card itself)
- Division-level display entirely — user clicks through to `/:leagueSlug` to see divisions

## Component Structure

Single file: `src/pages/homepage/LeaguesSection.jsx`

```
LeaguesSection ({ leagues, canPreview })
├── SectionGroup ({ status, label, dotColor, leagues })
│   ├── section header
│   └── card grid
│       └── LeagueCard ({ league, status }) × N
└── (repeat for each non-empty status group)
```

## Routing

| Card Status | Click Target |
|------------|--------------|
| Live | `/:leagueSlug` (division list page) |
| Signup | Signup route from `SIGNUP_ROUTES` map |
| Not Active | Not clickable |

## Existing Utilities Used

- `getLeagueLogo(slug, imageUrl)` from `src/utils/leagueImages.js` — resolves logo
- `SIGNUP_ROUTES` — kept as-is, maps slugs to signup paths
- `canPreview(leagueId)` — includes preview-accessible seasons in "active" check

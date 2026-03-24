# Landing Page Redesign — Design Brief

## What This Is

**SMITE 2 Companion** (smitecomp.com) is a community-built platform for competitive SMITE 2 esports. It started as a stats tracker but has grown into a full ecosystem with trading cards, a fantasy market, gamification, and more. The landing page needs to reflect this evolution.

## What to Keep

- **General color scheme** (see below)
- **Passion Promo Banner** — the interactive gamification banner stays as-is (described below)
- **Overall dark, premium gaming aesthetic** — this is not a corporate SaaS landing page

## Color Scheme (must preserve)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#101829` | Main background (deep navy) |
| `--color-secondary` | `#060d1a` | Darker background / cards |
| `--color-accent` | `#f8c56a` | Gold accent — buttons, highlights, headings |
| `--color-text` | `#ffffff` | Primary text |
| `--color-text-secondary` | `#d2d2d2` | Secondary/muted text |
| `--nav-bg` | `rgba(30, 36, 53, 0.75)` | Nav bar (frosted glass) |

**Fonts:** Montserrat (headings, bold/black weight), Lato (body)

**Accent gradients used throughout:**
- Gold button: `linear-gradient(135deg, #f8c56a, #e5a84e)` with dark text
- Gold text: `linear-gradient(135deg, #f8c56a, #fde68a, #f8c56a)` as background-clip
- Radial glow: `radial-gradient(circle, #f8c56a, transparent)` for ambient light
- Divider lines: `linear-gradient(90deg, transparent, #f8c56a/0.3, transparent)`
- Cards: `linear-gradient(135deg, var(--color-secondary), var(--color-primary))` with `border border-white/10`

---

## Current Page Structure (top to bottom)

### 1. Hero Section
- Full viewport height (~85vh), dark background with subtle radial gold glows and grid overlay
- Left side: SMITE 2 logo + "Community-Driven Competitive" badge, heading "The Battleground Lives On" (gradient text with interactive mouse-tracking light effect), subtitle about stats/standings/tools, two CTAs ("Explore Leagues" gold button + "Learn More" outline button)
- Right side: Perspective-tilted screenshot of the stats dashboard with 3D mouse-tracking tilt effect, edge fades blending into background
- Overall vibe: cinematic, interactive, premium

### 2. Reporter Notification (conditional)
- Only shows for admins with reporting permissions — small banner with match count. Not relevant to redesign.

### 3. Leagues Section ("Choose Your League")
- Each league has a header row (logo, name, Live/Signups badge, Discord link, View League link)
- Some leagues have special promo banners (AGL with diamonds/cash prizes, SAL with beginner-friendly badges)
- Division cards in a 3-column grid — each shows division name, rank tier icon, active season name
- Inactive divisions are greyed out

### 4. Passion Promo Banner (KEEP THIS)
- Interactive 3D flippable coin that reveals the full banner on first click
- Shows: "Passion Fuels Everything" headline with shimmer animation, animated rank badge cycling through 27 ranks with explosion effects
- CTA: Daily claim button (if available), Challenges link
- Three promo cards: "Rank Up" (27-rank ladder), "How to Earn" (daily logins, challenges, etc.), "Passion Shop" (spend on rewards)
- Pulsing gold border, dark background with gold radial glows and grid overlay
- **This section stays exactly as-is in the redesign.**

### 5. Tools Section ("More Than Just Stats")
- 3-column grid of tool cards:
  - **Draft Simulator** — pick/ban practice with full god pool
  - **Player Tier Lists** — drag-and-drop player rankings, exportable images
  - **God Tier List** — S/A/B/C/D/F god rankings
  - **Comp Profile** — Discord-linked player profile with KDA/match history (has login/claim CTA)
- Each card: icon + title + description + gold "Try It Out" button

### 6. Features Section ("What is smitecomp.com?")
- 6-card grid explaining core platform features:
  - Live Standings, Player Stats, Match History, Tier Lists, Draft Simulator, Player Profiles
- Simple icon + title + description cards

### 7. Story Section ("Built by Passion, for Passion")
- Left: narrative text about SPL being canceled and community keeping competitive SMITE alive
- Right: stats card showing Active Leagues count, Total Divisions count, rank tier icons

### 8. Community Section ("Powered by the Community")
- Three cards: Organizers & Admins, Casters & Streamers, Players & Captains
- Each with icon + description of their role

### 9. Challenge Banner
- Small banner promoting the challenges system

### 10. Passion CTA ("Passion never stops / Passion never dies / Unlimited Passion")
- Full-width rounded card with layered fire background (radial gradients in red/orange/gold)
- Animated fire emojis (floating, multi-row), ember particles
- Three-line animated text reveal with fire gradient on "Unlimited Passion"
- Gold "Get Started" CTA button
- Pulsing border glow animation

### 11. Footer
- Logo + site name, Discord link, Support link, "Not affiliated with Hi-Rez" disclaimer
- Hidden "Flip coin" easter egg link

---

## New Features That Need Landing Page Presence

### The Vault (Card Collection & Economy)
**What it is:** A full trading card system built around competitive SMITE players. Users collect, trade, and invest in player cards with varying rarities and holographic effects.

**Key features to showcase:**
- **Pack Opening** — Buy and open card packs with animated reveal. Multiple pack types including limited editions and a "Black Market" for rare packs
- **Card Collection** — Browse owned cards organized by rarity (common through mythic/unique). Cards feature real player data, stats, team info, and holographic effects (Holo, Reverse Holo, Full Art)
- **Starting Five** — Slot one card per SMITE role (Solo, Jungle, Mid, Support, ADC) to earn passive Passion and Cores daily. Holo cards earn more. Income accrues and caps at 2 days' worth
- **Marketplace** — List cards for sale, browse listings, view price history. Full buy/sell economy
- **Tradematch** — Tinder-style card trading: build a trade pile, swipe on other players' cards, match when interest is mutual, then negotiate
- **Bounty Board** — Post bounties offering Cores for specific cards you want, or fulfill others' bounties
- **Binder** — Curate and share card collections with others
- **Card Catalog** — Search/filter the full card database by god, rarity, holo type, special editions

**Visual identity:** Pokemon-card-inspired holographic effects, pack art with custom CSS animations, dark card frames with rarity-colored accents

### Fantasy Forge (Player Investment Market)
**What it is:** A speculative fantasy market where users invest in competitive players. "Fuel" a player to drive their price up (you profit from the rise), "Cool" to sell your position. Prices fluctuate based on real in-game performance.

**Key features to showcase:**
- **Market Browser** — Browse all players with real-time price heat indicators, 24h/7d price changes, performance multipliers, and spark counts. Filter by team, role, search
- **Fuel/Cool Actions** — One-tap invest ("Fuel") or divest ("Cool") on any player. Visual heat indicators show market sentiment
- **Portfolio** — Track your holdings, unrealized gains/losses, spark allocation across players
- **Leaderboard** — Rankings by current price, price movement, performance
- **Sparkline Charts** — Mini price trend visualizations on every player card

**Visual identity:** Financial market aesthetic with heat maps (hot red/orange for rising, cool blue for falling), sparkline charts, percentage badges

### Other Features Worth Including

- **Codex** — Wiki-style database of SMITE gods and items with image galleries and a Wordle mini-game
- **Scrim Planner** — Scrimmage scheduling platform for competitive teams (post open scrims, direct challenges, reliability tracking)
- **Challenges** — Achievement system with permanent and rotating weekly challenges rewarding Passion and Cores

---

## What's Wrong With the Current Page

1. **The Vault and Forge don't exist on the page at all** — these are now the biggest engagement features
2. **The Tools section is too small** — only 4 cards, doesn't reflect the platform's scope
3. **Features section is redundant** — the 6-card "What is smitecomp.com?" grid repeats things already shown in Tools and Leagues
4. **Story and Community sections are fine but generic** — could be more impactful
5. **Too much vertical scrolling** — sections feel disconnected, page is very long
6. **No visual previews** — the hero screenshot is the only visual; Vault cards, Forge sparklines, etc. deserve showcase treatment

---

## Design Goals for Redesign

1. **Vault and Forge need prominent, visually rich sections** — these are the hooks for retention. Show card art, holographic effects, market heat. Make people want to open packs and invest.
2. **Consolidate redundant sections** — merge Features + Tools into a single showcase. Remove or tighten Story/Community if needed.
3. **Keep the page's current premium gaming tone** — dark, gold accents, subtle animations, no corporate blandness
4. **Passion Banner stays** — it's the bridge between browsing and engagement. Keep it between Leagues and the feature showcase.
5. **Mobile-first consideration** — many users are on phones. Cards/grids should stack cleanly.
6. **Show, don't just tell** — use screenshots, card art previews, or mockup visuals for Vault/Forge sections instead of just text descriptions

---

## Suggested Section Order (flexible)

1. **Hero** — update subtitle/tagline to reference the broader platform (not just stats)
2. **Leagues** — keep as-is (dynamic, shows live seasons)
3. **Passion Banner** — keep as-is
4. **The Vault** — NEW hero-style section with card art, pack opening teaser, Starting Five preview
5. **Fantasy Forge** — NEW section with market heat visualization, sparklines, fuel/cool concept
6. **Tools & Features** — consolidated grid (Draft Sim, Tier Lists, Profiles, Codex, Scrim Planner, Challenges)
7. **Story / Community** — tightened, maybe combined into one section
8. **Passion CTA** — keep the fire section as a closer
9. **Footer**

---

## Assets Available

- Player trading cards with holographic CSS effects (Pokemon-card-inspired)
- Pack art with custom illustrations
- Rank badges (27 tiers from Clay to Deity)
- Passion coin (3D flippable, heads/tails)
- SMITE 2 logo
- Stats dashboard screenshot
- Division rank tier icons (Bronze, Silver, Gold, etc.)
- Lucide icon library (React)
- God images from the Codex database

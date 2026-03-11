# Vault Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all vault pages functional on every screen size, with a bottom tab bar replacing the horizontal tabs at <1400px, fullscreen scrollable packs on mobile, and responsive layouts for all tab pages.

**Architecture:** Three breakpoint tiers — (1) <1400px: bottom tab bar replaces top tabs, (2) <1200px: Starting 5 grid shifts + page optimizations, (3) <640px: full mobile layouts. All changes use Tailwind responsive classes plus a few CSS additions. No structural/logic changes to existing components — purely layout adaptations.

**Tech Stack:** Tailwind CSS 4 responsive prefixes, CSS scroll-snap, existing compdeck.css for custom breakpoints.

---

## Chunk 1: Bottom Tab Bar (replaces top tabs at <1400px)

### Task 1: Create VaultTabBar component

**Files:**
- Create: `src/pages/vault/VaultTabBar.jsx`
- Modify: `src/pages/VaultPage.jsx:97-138`

This is the most impactful change. At <1400px, hide the existing horizontal top tabs and show a fixed bottom tab bar with 4 primary tabs + a "More" menu.

- [ ] **Step 1: Create VaultTabBar.jsx**

```jsx
// src/pages/vault/VaultTabBar.jsx
import { useState } from 'react'
import { Package, Users, Library, Store, MoreHorizontal, X } from 'lucide-react'

const PRIMARY_TABS = [
  { key: 'packs', label: 'Packs', icon: Package },
  { key: 'lineup', label: 'Starting 5', icon: Users },
  { key: 'collection', label: 'Collection', icon: Library },
  { key: 'market', label: 'Market', icon: Store },
]

export default function VaultTabBar({ tabs, activeTab, onTabChange, unseenGifts, pendingTradeCount }) {
  const [moreOpen, setMoreOpen] = useState(false)

  const primaryKeys = new Set(PRIMARY_TABS.map(t => t.key))
  const secondaryTabs = tabs.filter(t => !primaryKeys.has(t.key))
  const activeIsSecondary = secondaryTabs.some(t => t.key === activeTab)

  // Badge logic: if gifts or trade tabs are in secondary, show dot on More
  const moreBadge = secondaryTabs.some(t =>
    (t.key === 'gifts' && unseenGifts > 0) ||
    (t.key === 'trade' && pendingTradeCount > 0)
  )

  return (
    <>
      {/* Backdrop for more menu */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More menu sheet */}
      {moreOpen && (
        <div
          className="fixed bottom-[68px] left-2 right-2 z-[100] bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-xl p-3 shadow-2xl"
          style={{ animation: 'cd-fade-in 0.15s ease-out' }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-white/30 uppercase tracking-widest cd-head font-bold">More</span>
            <button onClick={() => setMoreOpen(false)} className="text-white/30 hover:text-white/60 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {secondaryTabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { onTabChange(tab.key); setMoreOpen(false) }}
                  className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-bold cd-head tracking-wider">{tab.label}</span>
                  {tab.key === 'gifts' && unseenGifts > 0 && (
                    <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[var(--cd-cyan)] text-[8px] font-bold text-black flex items-center justify-center">
                      {unseenGifts}
                    </span>
                  )}
                  {tab.key === 'trade' && pendingTradeCount > 0 && (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[var(--cd-magenta)] animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[98] bg-[var(--cd-bg)]/95 backdrop-blur-md border-t border-[var(--cd-border)] px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { onTabChange(tab.key); setMoreOpen(false) }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all cursor-pointer ${
                  active ? 'text-[var(--cd-cyan)]' : 'text-white/30'
                }`}
              >
                <Icon size={20} className={active ? 'cd-icon-glow' : ''} />
                <span className="text-[9px] font-bold cd-head tracking-wider">{tab.label}</span>
                {active && (
                  <span className="w-4 h-0.5 rounded-full bg-[var(--cd-cyan)] mt-0.5" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.4)' }} />
                )}
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all cursor-pointer relative ${
              moreOpen || activeIsSecondary ? 'text-[var(--cd-cyan)]' : 'text-white/30'
            }`}
          >
            <MoreHorizontal size={20} className={moreOpen || activeIsSecondary ? 'cd-icon-glow' : ''} />
            <span className="text-[9px] font-bold cd-head tracking-wider">More</span>
            {moreBadge && !moreOpen && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-[var(--cd-cyan)] animate-pulse" />
            )}
            {(moreOpen || activeIsSecondary) && (
              <span className="w-4 h-0.5 rounded-full bg-[var(--cd-cyan)] mt-0.5" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.4)' }} />
            )}
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Wire VaultTabBar into VaultPage.jsx**

In `VaultPage.jsx`, replace the existing tab bar section (lines 107-138) with a conditional render:
- At >=1400px (`hidden 2xl:flex` — we'll use a custom `vault` breakpoint at 1400px): show existing horizontal tabs
- At <1400px (`2xl:hidden`): show VaultTabBar at bottom

Since Tailwind 4 doesn't have a 1400px breakpoint by default, use the existing `--breakpoint-sidebar: 87.5rem` (1400px) from `index.css`, which maps to `sidebar:` prefix.

Modify `VaultInner` in `VaultPage.jsx`:

```jsx
// After the VaultHeroBanner div, replace the <main> content:

// Add import at top:
import VaultTabBar from './vault/VaultTabBar'

// In VaultInner, replace the tab switcher div (lines 107-138) with:

{/* Desktop tab switcher — hidden below 1400px */}
<div className="relative z-10 hidden sidebar:flex items-center gap-6 border-b border-[var(--cd-border)] pb-0">
  {/* ...existing tab buttons unchanged... */}
</div>

// Before closing </div> of the compdeck wrapper, add:

{/* Mobile/tablet bottom tab bar — shown below 1400px */}
<div className="sidebar:hidden">
  <VaultTabBar
    tabs={visibleTabs}
    activeTab={activeTab}
    onTabChange={setTab}
    unseenGifts={unseenGifts}
    pendingTradeCount={pendingTradeCount}
  />
</div>
```

Also add bottom padding to `<main>` when tab bar is visible so content isn't hidden behind it:

```jsx
<main className="relative z-1 max-w-[1400px] mx-auto px-4 pt-6 pb-20 sidebar:pb-0">
```

- [ ] **Step 3: Verify the `sidebar:` breakpoint works**

The `--breakpoint-sidebar: 87.5rem` is already in `src/index.css`. Tailwind 4 auto-generates `sidebar:` prefix from this. Run `npm run dev` and resize browser to confirm:
- At >=1400px: horizontal top tabs visible, no bottom bar
- At <1400px: top tabs hidden, bottom tab bar visible
- Tab switching works correctly in both modes
- Gift badge and trade dot show on More button when those tabs have notifications
- More menu opens/closes correctly
- Active secondary tab highlights the More button

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/VaultTabBar.jsx src/pages/VaultPage.jsx
git commit -m "feat: add responsive bottom tab bar for vault at <1400px"
```

---

## Chunk 2: Pack Shop — fullscreen scroll on mobile

### Task 2: Make CCPackShop responsive

**Files:**
- Modify: `src/pages/vault/CCPackShop.jsx:314-511`

The pack shop currently uses a centered row with animated focus/zoom to viewport center + fixed info panel to the right. On mobile (<640px), this doesn't work. Replace with horizontal snap scroll where each pack fills the viewport, info + buy button below.

- [ ] **Step 1: Add mobile layout to PackShop**

In `CCPackShop.jsx`, the `PackShop` component (line 266) renders the pack showcase. Add a conditional mobile layout:

Replace the pack showcase section (lines 316-454) with responsive alternatives:

```jsx
{/* ═══ Pack Showcase — Desktop (>=640px) ═══ */}
<div className="hidden sm:block">
  {/* existing pack showcase code unchanged (lines 317-454) */}
</div>

{/* ═══ Pack Showcase — Mobile (<640px) ═══ */}
<div className="sm:hidden">
  <div
    className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none -mx-4 px-4 gap-4 pb-4"
    style={{ scrollbarWidth: 'none' }}
  >
    {LEAGUE_PACKS.map((key) => {
      const pack = PACKS[key];
      const meta = PACK_META[key];
      const canAfford = emberBalance >= pack.cost;

      return (
        <div
          key={key}
          className="snap-center shrink-0 w-full flex flex-col items-center"
        >
          {/* Pack art — large and centered */}
          <div className="relative py-6">
            <div
              className="absolute -inset-16 rounded-3xl"
              style={{
                background: `radial-gradient(ellipse, ${pack.color || 'var(--cd-cyan)'}30 0%, transparent 70%)`,
                filter: 'blur(40px)',
                opacity: 0.5,
              }}
            />
            <PackArt tier={key} name={pack.name} subtitle={meta.subtitle} cardCount={pack.cards} seed={meta.seed} />
          </div>

          {/* Pack info card */}
          <div className="cd-panel cd-corners rounded-xl p-5 w-full mt-2">
            <h3 className="cd-head text-xl font-bold mb-1" style={{ color: pack.color || 'var(--cd-cyan)', letterSpacing: '0.12em' }}>
              {pack.name}
            </h3>
            <p className="text-xs text-white/40 cd-head tracking-widest mb-4">{meta.subtitle}</p>

            <div className="space-y-2 mb-5 text-[13px] text-white/60">
              <div className="flex items-center gap-2">
                <span><span className="text-white font-bold">6</span> cards per pack</span>
              </div>
              <div className="flex items-center gap-2">
                <span>1 guaranteed <span className="font-bold" style={{ color: pack.color }}>{pack.leagueName?.split(' ')[0]}</span> player</span>
              </div>
              <div className="flex items-center gap-2">
                <span>1 <span className="text-green-400 font-bold">Rare+</span> guaranteed slot</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mb-4">
              <img src={emberIcon} alt="" className="h-5 w-auto object-contain cd-icon-glow" />
              <span className="text-2xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{pack.cost}</span>
              <span className="text-sm text-white/40 cd-head tracking-wider">Cores</span>
            </div>

            <CDChargeButton
              label={canAfford ? `Open for ${pack.cost}` : `Need ${pack.cost} Cores`}
              onFire={() => handleBuyPack(key)}
              disabled={!canAfford || !!openResult}
            />
          </div>
        </div>
      );
    })}
  </div>

  {/* Scroll indicator dots */}
  <div className="flex justify-center gap-2 mt-2 mb-4">
    {LEAGUE_PACKS.map((key, i) => (
      <div key={key} className="w-1.5 h-1.5 rounded-full bg-white/20" />
    ))}
  </div>
</div>
```

The desktop code (existing lines 317-454) wraps in `<div className="hidden sm:block">` with no changes to that code.

- [ ] **Step 2: Make economy panel responsive**

The economy panel (lines 476-484) is already `grid-cols-1 sm:grid-cols-2` so it works. No changes needed.

- [ ] **Step 3: Verify**

Run dev server, test at mobile width:
- Packs fill viewport width with horizontal snap scroll
- Pack info + buy button visible below each pack
- Economy panel stacks vertically
- Desktop layout unchanged at >=640px

- [ ] **Step 4: Commit**

```bash
git add src/pages/vault/CCPackShop.jsx
git commit -m "feat: fullscreen scrollable pack cards on mobile"
```

---

## Chunk 3: Vending Machine — scale down on mobile

### Task 3: Make CCPackSale responsive

**Files:**
- Modify: `src/pages/vault/vendingmachine.css`

The vending machine is 520px wide in the alley scene. On mobile, scale it down and hide the alley SVG buildings.

- [ ] **Step 1: Add responsive CSS to vendingmachine.css**

Append to `vendingmachine.css` before the reduced-motion section (before line 800):

```css
/* ═══════════════════════════════════════════════
   RESPONSIVE — Mobile scaling
   ═══════════════════════════════════════════════ */

@media (max-width: 639px) {
  .alley {
    min-height: auto;
    padding: 1rem 0.5rem 0;
  }

  .alley-svg {
    display: none;
  }

  .alley-content .vm-body,
  .vm-body {
    width: 100%;
    max-width: 340px;
    border-radius: 10px 10px 4px 4px;
  }

  .vm-header {
    padding: 8px 12px;
  }

  .vm-header-text {
    font-size: 20px;
    letter-spacing: 0.2em;
  }

  .vm-glass-inner {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 8px;
  }

  .vm-slot {
    padding: 6px 4px;
  }

  .vm-slot-pack {
    transform: scale(0.45);
  }

  .vm-slot-name {
    font-size: 8px;
  }

  .vm-slot-price {
    font-size: 9px;
  }

  .vm-slot-stock {
    font-size: 8px;
  }

  .vm-controls {
    padding: 10px;
    gap: 8px;
  }

  .vm-display {
    padding: 8px;
  }

  .vm-display-line1 {
    font-size: 14px;
  }

  .vm-display-line2 {
    font-size: 10px;
  }

  .vm-keypad {
    gap: 4px;
  }

  .vm-key {
    min-width: 28px;
    min-height: 28px;
    font-size: 11px;
  }

  .vm-vend-btn {
    padding: 8px 16px;
    font-size: 14px;
  }

  .vm-tray {
    min-height: 50px;
  }
}

/* Tablet range — moderate shrink */
@media (min-width: 640px) and (max-width: 1023px) {
  .alley-content .vm-body,
  .vm-body {
    width: 440px;
  }
}
```

- [ ] **Step 2: Verify**

- Mobile: machine fits screen, no horizontal scroll, all controls usable
- Alley SVG hidden on mobile (wastes space, barely visible anyway)
- Tablet: machine slightly smaller but fully functional
- Desktop: unchanged

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/vendingmachine.css
git commit -m "feat: responsive vending machine scaling for mobile/tablet"
```

---

## Chunk 4: Starting 5 — responsive grid

### Task 4: Make CCStartingFive responsive

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx:224-436`

The Starting 5 has two problem areas: the income dashboard and the 5-column role grid.

- [ ] **Step 1: Make income dashboard responsive**

Replace the income dashboard content (lines 233-327). The current layout is `flex items-center justify-between` with two stat columns + collect button. On mobile, stack vertically:

```jsx
{/* Income Dashboard */}
<div className="cd-panel cd-corners rounded-xl p-5 mb-8">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
    <div className="flex items-center gap-6">
      {/* Passion income — unchanged */}
      <div className="flex flex-col gap-1">
        {/* ...existing passion column code... */}
      </div>
      {/* Cores income — unchanged */}
      <div className="flex flex-col gap-1">
        {/* ...existing cores column code... */}
      </div>
    </div>

    {/* Collect button */}
    <div className="relative">
      <button
        onClick={handleCollect}
        disabled={!canCollect || collecting}
        className="cd-btn-solid cd-btn-action cd-clip-btn px-6 py-2.5 text-sm font-bold cd-head tracking-wider cursor-pointer disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {collecting ? 'Collecting...' : 'Collect'}
      </button>
      {/* ...existing collectNotif... */}
    </div>
  </div>
  <div className="text-[10px] text-white/20">
    {STARTING_FIVE_CAP_DAYS}-day cap — collect before your income maxes out
  </div>
</div>
```

Key changes: `flex-col sm:flex-row`, collect button `w-full sm:w-auto`, progress bars `w-24 sm:w-32`.

- [ ] **Step 2: Make role slots grid responsive**

Replace line 330 `grid grid-cols-5 gap-4` with responsive grid:

```jsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
```

This gives:
- Mobile (<640px): 2 columns (2+2+1 layout, last centered via `last:col-span-2 last:justify-self-center` — or just let it flow)
- Tablet (640-1023px): 3 columns (3+2 layout)
- Desktop (>=1024px): 5 columns (current)

- [ ] **Step 3: Scale card sizes responsively**

In `EmptySlot` (line 446) and `FilledSlot` (line 480), the cards are hardcoded at `170px`. Replace with a responsive approach.

In `EmptySlot`, change:
```jsx
style={{ width: 170, aspectRatio: '63/88' }}
```
to:
```jsx
style={{ aspectRatio: '63/88' }}
className="... w-[140px] sm:w-[155px] lg:w-[170px]"
```

Similarly in `FilledSlot`, change the `TradingCardHolo` size prop and info maxWidth:
```jsx
<TradingCardHolo ... size={170}>
```

Since `size` is a prop, we need a different approach. Add a constant or pass it down. Simplest: use a CSS wrapper that constrains width, and let the card fill it. Or use a responsive size value.

Add to `CCStartingFive.jsx` at the top of the component:

```jsx
const [slotSize, setSlotSize] = useState(170)

useEffect(() => {
  const update = () => {
    if (window.innerWidth < 640) setSlotSize(140)
    else if (window.innerWidth < 1024) setSlotSize(155)
    else setSlotSize(170)
  }
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
}, [])
```

Pass `slotSize` to `EmptySlot` and `FilledSlot` as a prop, replacing the hardcoded 170.

- [ ] **Step 4: Make card picker modal responsive**

The picker modal (line 686) uses `max-w-2xl max-h-[80vh]`. On mobile, make it full-screen:

```jsx
className="relative w-full max-w-2xl sm:max-h-[80vh] max-h-[100dvh] bg-[var(--cd-surface)] border border-[var(--cd-border)] sm:rounded-xl overflow-hidden sm:mx-4"
```

- [ ] **Step 5: Verify**

- Mobile: 2-column grid, smaller cards, income dashboard stacked, picker is full-screen
- Tablet: 3-column grid, medium cards
- Desktop: 5-column grid, unchanged

- [ ] **Step 6: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat: responsive Starting 5 with grid breakpoints and scaled cards"
```

---

## Chunk 5: Collection, Marketplace, and other tab pages

### Task 5: Make CCCollection responsive

**Files:**
- Modify: `src/pages/vault/CCCollection.jsx:248-300`

The main issue is the fixed `w-52` sidebar. On mobile, convert it to a horizontal scrollable filter strip or a dropdown.

- [ ] **Step 1: Make sidebar responsive**

Replace the `flex gap-6` wrapper (line 248) with responsive layout:

```jsx
<div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
  {/* Sidebar — horizontal scroll on mobile, vertical on desktop */}
  <div className="lg:w-52 lg:shrink-0">
    {/* Mobile: horizontal scrollable strip */}
    <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-none pb-2" style={{ scrollbarWidth: 'none' }}>
      {/* Render GAME_SECTIONS as horizontal pills */}
      {GAME_SECTIONS.map(s => {
        const active = activeSection === s.type
        return (
          <button
            key={s.type}
            onClick={() => setActiveSection(s.type)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
              active
                ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        )
      })}
      {/* Player sets as pills too */}
      {leagueSeasonGroups.flatMap(group =>
        group.divisions.map(set => {
          const active = activeSection === `player:${set.key}`
          return (
            <button
              key={set.key}
              onClick={() => setActiveSection(`player:${set.key}`)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer cd-head ${
                active
                  ? 'bg-[var(--cd-cyan)]/15 text-[var(--cd-cyan)] border border-[var(--cd-cyan)]/25'
                  : 'bg-white/[0.04] text-[var(--cd-text-mid)] hover:bg-white/[0.06]'
              }`}
            >
              <span>{set.divisionName || 'Division'}</span>
            </button>
          )
        })
      )}
    </div>

    {/* Desktop: existing vertical sidebar (unchanged) */}
    <div className="hidden lg:block space-y-1">
      {/* ...existing sidebar buttons unchanged... */}
    </div>
  </div>

  {/* Main content */}
  <div className="flex-1 min-w-0">
    {/* ...existing card grid unchanged... */}
  </div>
</div>
```

- [ ] **Step 2: Verify**

- Mobile: horizontal scrollable pills for section selection, cards fill width
- Desktop: unchanged vertical sidebar

- [ ] **Step 3: Commit**

```bash
git add src/pages/vault/CCCollection.jsx
git commit -m "feat: responsive collection sidebar as horizontal pills on mobile"
```

### Task 6: Make CCMarketplace responsive

**Files:**
- Modify: `src/pages/vault/CCMarketplace.jsx`

The marketplace has filters + card grid. Apply same pill pattern for filters on mobile, and scale card sizes.

- [ ] **Step 1: Make marketplace filters responsive**

The marketplace uses a top filter bar with dropdowns (type, rarity, sort, search). These likely already wrap decently. The main thing is to ensure the browse card grid adapts:

In the browse section, change `BROWSE_CARD_SIZE` usage to be responsive. Wrap the card grid flex container:

```jsx
{/* Add responsive card sizing */}
<div className="flex flex-wrap gap-2 sm:gap-3">
  {/* Cards render at responsive size: 110px mobile, 140px desktop */}
</div>
```

For the "Create listing" section, ensure the card selection grid wraps properly at smaller sizes.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCMarketplace.jsx
git commit -m "feat: responsive marketplace card grid"
```

### Task 7: Make CCTrading responsive

**Files:**
- Modify: `src/pages/vault/CCTrading.jsx`

The trading room shows both users' card collections side-by-side. On mobile, this needs to stack or use tabs.

- [ ] **Step 1: Make trade room responsive**

The trade room likely uses a flex row for the two sides. Change to:

```jsx
<div className="flex flex-col lg:flex-row gap-4">
```

This stacks the two collection panels vertically on mobile/tablet. Each panel fills full width.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCTrading.jsx
git commit -m "feat: responsive trading room layout"
```

### Task 8: Make CCDismantle responsive

**Files:**
- Modify: `src/pages/vault/CCDismantle.jsx`

- [ ] **Step 1: Responsive card grid**

The dismantle page has a card selection grid. Ensure it uses responsive sizing. The card grid likely uses flex-wrap which should work. Main concern is the action bar with totals — ensure it's usable on mobile. Make it a sticky bottom bar:

For the dismantle confirmation/total area, add:
```jsx
className="sticky bottom-20 sm:bottom-0 ..."
```

(bottom-20 to clear the tab bar on mobile)

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCDismantle.jsx
git commit -m "feat: responsive dismantle page with sticky action bar"
```

### Task 9: Make CCGifts responsive

**Files:**
- Modify: `src/pages/vault/CCGifts.jsx`

- [ ] **Step 1: Responsive adjustments**

The gifts page has internal tabs (Received/Send/Sent) and gift card grids. The internal tabs should be fine as they're just 3 buttons. Ensure gift card items stack properly at narrow widths. Should mostly work with existing flex-wrap, but check and adjust any fixed widths.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCGifts.jsx
git commit -m "feat: responsive gifts page"
```

### Task 10: Make CCCardCatalog responsive

**Files:**
- Modify: `src/pages/vault/CCCardCatalog.jsx`

- [ ] **Step 1: Responsive card grid**

Same pattern as collection — ensure filters work as horizontal pills and card grid adapts.

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCCardCatalog.jsx
git commit -m "feat: responsive catalog page"
```

---

## Chunk 6: Global padding and final polish

### Task 11: Add safe bottom padding for tab bar

**Files:**
- Modify: `src/pages/VaultPage.jsx`

- [ ] **Step 1: Bottom padding for tab bar**

Ensure `<main>` has enough bottom padding so content isn't hidden behind the bottom tab bar. Already addressed in Task 1 Step 2 with `pb-20 sidebar:pb-0`.

Also ensure the gift notification banner (lines 144-153) doesn't overlap with bottom bar — it's in the main flow so it should be fine.

- [ ] **Step 2: Full visual sweep**

Test every tab at these widths:
- 375px (iPhone SE)
- 430px (iPhone 14 Pro Max)
- 768px (iPad)
- 1024px (iPad Pro)
- 1200px (small laptop)
- 1400px (breakpoint boundary)
- 1920px (desktop)

Confirm:
- Tab bar transitions cleanly at 1400px
- No horizontal scrollbar appears at any width
- All interactive elements (buttons, inputs) are finger-sized on mobile (min 44px touch target)
- Card grids don't overflow
- Modals are usable on mobile

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: vault responsive design polish and safe area handling"
```

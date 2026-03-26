# Staff Card Type + Starting 5 Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `staff` card type and two new current-lineup-only Starting 5 slots (cheerleader, staff) with minor flat+mult income bonuses that scale by rarity.

**Architecture:** Staff cards are a new `card_type` created in Vault Studio. Two new lineup roles (`cheerleader`, `staff`) are added to `cc_lineups` for `lineup_type='current'` only. Staff slots provide both flat cores and a multiplier bonus (no Passion), have no attachments, no role matching, and no team synergy. The income calculation in `starting-five.js` is extended with a dedicated code path for staff-type cards. Staff cards have no `team_id` (NULL from LEFT JOIN on `cc_player_defs`) so they're naturally excluded from team synergy counting.

**Tech Stack:** PostgreSQL (Neon), Cloudflare Pages Functions, React 19, Tailwind CSS 4

---

### Task 1: Database migration — expand cc_lineups role CHECK constraint

**Files:**
- Create: `database/migrations/144-staff-lineup-roles.sql`

The `cc_lineups` table has a CHECK constraint (from migration 126) that only allows `('solo', 'jungle', 'mid', 'support', 'adc', 'bench')`. Without updating it, any INSERT with `role = 'cheerleader'` or `role = 'staff'` will fail with a PostgreSQL constraint violation.

- [ ] **Step 1: Create migration file**

```sql
-- Add cheerleader and staff roles to cc_lineups for Starting 5 staff card slots
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_role_check;
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_role_check
  CHECK (role IN ('solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff'));
```

- [ ] **Step 2: Run migration against the database**

- [ ] **Step 3: Commit**

```bash
git add database/migrations/144-staff-lineup-roles.sql
git commit -m "feat(vault): expand cc_lineups role constraint for staff slots"
```

---

### Task 2: Add staff income constants to backend

**Files:**
- Modify: `functions/lib/starting-five.js:1-31`

- [ ] **Step 1: Add staff constants after the existing S5 constants (after line 30)**

```javascript
// Staff card slots — flat cores/day + multiplier, no Passion
const S5_STAFF_FLAT_CORES = {
  uncommon: 0.02, rare: 0.05, epic: 0.10, legendary: 0.15, mythic: 0.20, unique: 0.25,
}
const S5_STAFF_MULT = {
  uncommon: 1.03, rare: 1.06, epic: 1.09, legendary: 1.12, mythic: 1.15, unique: 1.18,
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(vault): add staff card income constants"
```

---

### Task 3: Add staff contribution to income calculation

**Files:**
- Modify: `functions/lib/starting-five.js:69-91` (getCardContribution)
- Modify: `functions/lib/starting-five.js:124-163` (calculateLineupOutput)
- Modify: `functions/lib/starting-five.js:191-194` (isRoleMismatch)

Staff cards bypass the holo_type logic entirely — they always contribute both flat cores and a multiplier regardless of holo_type. Common staff cards contribute nothing.

- [ ] **Step 1: Create `getStaffContribution` function after `getCardContribution`**

```javascript
export function getStaffContribution(rarity) {
  const cores = S5_STAFF_FLAT_CORES[rarity] || 0
  const mult = S5_STAFF_MULT[rarity] || 1
  if (cores === 0 && mult === 1) return { type: 'none' }
  return { type: 'staff', cores, passion: 0, multiplier: mult }
}
```

- [ ] **Step 2: Update `isRoleMismatch` to skip staff slots**

Staff slots have no role matching — they should never be flagged as mismatched. Currently at line 191:

```javascript
export function isRoleMismatch(card) {
  if (card.slot_role === 'bench') return false
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
}
```

Change to:

```javascript
export function isRoleMismatch(card) {
  if (card.slot_role === 'bench' || card.slot_role === 'cheerleader' || card.slot_role === 'staff') return false
  return card.slot_role && card.role && card.role !== card.slot_role && card.role !== 'fill'
}
```

- [ ] **Step 3: Update `calculateLineupOutput` to handle staff cards**

In the loop at line 128, add a branch for staff card_type before the existing contribution logic. Staff cards contribute their own flat cores and multiplier directly, with no attachments and no team synergy:

```javascript
export function calculateLineupOutput(cards, teamCounts = {}) {
  let totalFlatCores = 0, totalFlatPassion = 0, totalMult = 1.0

  for (const card of cards) {
    if (isRoleMismatch(card)) continue

    // Staff cards: dedicated path, no attachments, no team synergy
    if (card.card_type === 'staff') {
      const staffContrib = getStaffContribution(card.rarity)
      if (staffContrib.type === 'staff') {
        totalFlatCores += staffContrib.cores
        totalMult += (staffContrib.multiplier - 1)
      }
      continue
    }

    const effectiveness = card.isBench ? S5_BENCH_EFFECTIVENESS : 1.0
    // ... rest of existing logic unchanged
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(vault): staff cards contribute flat cores + mult to lineup income"
```

---

### Task 4: Update slotCard/unslotCard validation for staff slots

**Files:**
- Modify: `functions/lib/starting-five.js:431-573`

- [ ] **Step 1: Add cheerleader and staff to validRoles in `slotCard`**

At line 432, change:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench']
```
to:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
```

- [ ] **Step 2: Add staff card_type branch in slotCard player validation**

Currently line 453-458 checks `card.card_type !== 'player'`. Add a branch before this for staff slots. After the marketplace/binder checks (line 452), restructure the `slotType === 'player'` block:

```javascript
  if (slotType === 'player') {
    // Staff slots only accept staff cards
    if (role === 'cheerleader' || role === 'staff') {
      if (card.card_type !== 'staff') throw new Error('Only staff cards can be slotted in staff/cheerleader slots')

      // Enforce current lineup only
      if (lineupType !== 'current') throw new Error('Staff slots are only available in the current season lineup')

      // Check not already slotted
      const [existing] = await sql`
        SELECT role, lineup_type FROM cc_lineups
        WHERE user_id = ${userId} AND card_id = ${cardId}
      `
      if (existing) throw new Error(`Card is already slotted in ${existing.lineup_type}/${existing.role}`)

      await collectIncome(sql, userId)

      await sql`
        INSERT INTO cc_lineups (user_id, lineup_type, role, card_id, slotted_at)
        VALUES (${userId}, ${lineupType}, ${role}, ${cardId}, NOW())
        ON CONFLICT (user_id, lineup_type, role)
        DO UPDATE SET card_id = ${cardId}, god_card_id = NULL, item_card_id = NULL, slotted_at = NOW()
      `
    } else {
      // Existing player card logic — add staff rejection before existing checks
      if (card.card_type === 'staff') throw new Error('Staff cards can only be slotted in cheerleader or staff slots')
      if (!card.holo_type && card.rarity !== 'common') throw new Error('Card has no holo type')
      if (card.card_type !== 'player') throw new Error('Only player cards can be slotted')
      // ... rest of existing player logic unchanged
    }
```

Note: The ON CONFLICT explicitly nulls god_card_id and item_card_id — staff slots should never have attachments. The existing player card ON CONFLICT (line 468-473) deliberately does NOT null these because it has separate rarity-floor logic afterwards; this difference is intentional.

- [ ] **Step 3: Add cheerleader and staff to validRoles in `unslotCard`**

At line 545, change:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench']
```
to:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
```

- [ ] **Step 4: Add cheerleader and staff to validRoles in `unslotAttachment`**

At line 560, change:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench']
```
to:
```javascript
const validRoles = ['solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff']
```

(Unslot attachment will still fail gracefully since staff slots won't have attachments, but having the role be valid prevents a confusing error.)

- [ ] **Step 5: Commit**

```bash
git add functions/lib/starting-five.js
git commit -m "feat(vault): slot/unslot validation for cheerleader and staff roles"
```

---

### Task 5: Update `formatS5Response` for staff slot contributions

**Files:**
- Modify: `functions/api/vault.js:1915-1953`

The `formatS5Response` function builds slot data for the frontend. Staff cards need a different contribution shape since they bypass the holo_type system.

- [ ] **Step 1: Import `getStaffContribution` at the top of vault.js**

Find the existing import from starting-five.js and add `getStaffContribution`:

```javascript
import { tick, collectIncome, slotCard, unslotCard, unslotAttachment, useConsumable,
  getCardContribution, getAttachmentBonusInfo, checkSynergy, isRoleMismatch, getStaffContribution,
  calculateLineupOutput, S5_ALLSTAR_MODIFIER, TEAM_SYNERGY_BONUS, CONSUMABLE_DAILY_CAP, getBuffTotals } from '../lib/starting-five.js'
```

- [ ] **Step 2: Update the `formatLineup` loop to handle staff cards**

In `formatS5Response` around line 1927, add a branch for staff card_type at the top of the loop:

```javascript
    for (const card of lineupCards) {
      // Staff cards: simpler contribution, no attachments, no synergy
      if (card.card_type === 'staff') {
        const contrib = getStaffContribution(card.rarity)
        slots[card.slot_role] = {
          card: formatCard(card),
          godCard: null,
          itemCard: null,
          contribution: contrib,
          godBonus: { flatBoost: 0, multAdd: 0, effectiveType: 'none' },
          itemBonus: { flatBoost: 0, multAdd: 0, effectiveType: 'none' },
          synergy: false,
          isBench: false,
          isStaffSlot: true,
          teamSynergyBonus: 0,
          roleMismatch: false,
        }
        continue
      }

      // Existing player card logic...
      const synergy = checkSynergy(card, card._godCard)
      // ...
```

Note: `isStaffSlot: true` is a new flag the frontend uses to suppress attachment UI and render the simplified slot component.

- [ ] **Step 3: Commit**

```bash
git add functions/api/vault.js
git commit -m "feat(vault): formatS5Response handles staff card slots"
```

---

### Task 6: Add staff constants to frontend economy.js

**Files:**
- Modify: `src/data/vault/economy.js:105-153`

- [ ] **Step 1: Add staff income constants after the existing S5 constants**

After `STARTING_FIVE_CAP_DAYS` (line 153):

```javascript
// Staff card slots — flat cores/day + multiplier, no Passion
export const S5_STAFF_FLAT_CORES = {
  uncommon: 0.02, rare: 0.05, epic: 0.10, legendary: 0.15, mythic: 0.20, unique: 0.25,
};

export const S5_STAFF_MULT = {
  uncommon: 1.03, rare: 1.06, epic: 1.09, legendary: 1.12, mythic: 1.15, unique: 1.18,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/data/vault/economy.js
git commit -m "feat(vault): add staff card income constants to frontend economy"
```

---

### Task 7: Add staff slots to Starting 5 UI

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx`

This is the main UI change. Two new slots render after the bench section, before the leaderboard. They follow the bench pattern but are simpler — no attachments, no role icon.

- [ ] **Step 1: Import staff economy constants**

At line 3, add `S5_STAFF_FLAT_CORES, S5_STAFF_MULT` to the existing import from economy:

```javascript
import { RARITIES, S5_FLAT_CORES, S5_FLAT_PASSION, S5_REVERSE_MULT, S5_FULL_RATIO,
  S5_FLAT_SCALE, S5_MULT_SCALE,
  S5_ATT_FLAT, S5_ATT_MULT, S5_FULL_ATT_RATIO, S5_ALLSTAR_MODIFIER,
  STARTING_FIVE_CAP_DAYS, CONSUMABLE_EFFECTS, getHoloEffect,
  S5_STAFF_FLAT_CORES, S5_STAFF_MULT } from '../../data/vault/economy'
```

- [ ] **Step 2: Define STAFF_SLOTS constant**

After the `ROLES` array (line 30):

```javascript
const STAFF_SLOTS = [
  { key: 'cheerleader', label: 'CHEERLEADER' },
  { key: 'staff', label: 'STAFF' },
]
```

- [ ] **Step 3: Verify `allSlottedIds` includes staff cards automatically**

The `allSlottedIds` useMemo (around line 310-323) uses `collectFromSlots()` which iterates `Object.values(slots)`. Since `formatS5Response` now puts staff cards into `slots.cheerleader` and `slots.staff`, they'll be included automatically. No change needed — just verify.

- [ ] **Step 4: Update `getBaseIncomeEstimate` for staff card sorting in CardPicker**

At line 77-88, this function estimates income for sorting cards in the picker. It uses player economy constants and holo_type logic that won't work for staff cards. Add a staff branch at the top:

```javascript
function getBaseIncomeEstimate(card) {
  if (!card) return { flatCores: 0, multiplier: 0, type: 'none', sortValue: 0 }
  // Staff cards: use staff-specific constants
  if (getCardType(card) === 'staff') {
    const cores = S5_STAFF_FLAT_CORES[card.rarity] || 0
    const mult = S5_STAFF_MULT[card.rarity] || 1
    return { flatCores: cores, multiplier: mult, type: 'staff', sortValue: cores + (mult - 1) * 10 }
  }
  const ht = card.holoType
  // ... rest unchanged
```

- [ ] **Step 5: Add staff slot UI section after the bench section**

After the bench section closing `</div>` (line 827), before the leaderboard (line 829), add. Only shown for current lineup:

```jsx
      {/* Staff Slots — current season only */}
      {activeLineup === 'current' && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider cd-head text-center">Staff</div>
          <div className="flex justify-center gap-3 sm:gap-4">
            {STAFF_SLOTS.map(staffSlot => {
              const card = slottedCards[staffSlot.key]
              const slotData = slots[staffSlot.key]
              const isAnimating = slotAnimation?.role === staffSlot.key

              return (
                <div key={staffSlot.key} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-white/40 cd-head tracking-wider">{staffSlot.label}</span>
                  </div>
                  <div className="relative">
                    {card ? (
                      <StaffFilledSlot
                        card={card}
                        role={staffSlot}
                        slotData={slotData}
                        isAnimating={isAnimating}
                        animConfig={isAnimating ? getAnimationConfig(slotAnimation.rarity) : null}
                        onSwap={() => setPickerRole(staffSlot.key)}
                        onRemove={() => handleUnslot(staffSlot.key)}
                        onZoom={() => { setOptionsRole(null); setZoomedCard(card) }}
                        optionsOpen={optionsRole === staffSlot.key}
                        onToggleOptions={() => setOptionsRole(optionsRole === staffSlot.key ? null : staffSlot.key)}
                        size={slotSize}
                        override={getDefOverride(card)}
                      />
                    ) : (
                      <button
                        onClick={() => setPickerRole(staffSlot.key)}
                        className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] hover:border-[var(--cd-cyan)]/30 hover:bg-[var(--cd-cyan)]/[0.03] transition-all cursor-pointer"
                        style={{ width: slotSize, aspectRatio: '63/88' }}
                      >
                        <Plus size={slotSize < 150 ? 22 : 28} className="opacity-[0.08] group-hover:opacity-30 transition-opacity mb-2 text-white" />
                        <div className="flex items-center gap-1 text-[11px] text-white/20 group-hover:text-[var(--cd-cyan)]/60 font-bold cd-head tracking-wider transition-colors">
                          <Plus size={12} />
                          {staffSlot.label}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 6: Create `StaffFilledSlot` component**

This is a simplified version of `FilledSlot` without attachment slots. Add it near the existing `FilledSlot` component. It renders the card the same way but shows staff-specific income (cores/day + multiplier %) and has no attachment sub-slots:

```jsx
function StaffFilledSlot({ card, role, slotData, isAnimating, animConfig, onSwap, onRemove, onZoom, optionsOpen, onToggleOptions, size = 170, override }) {
  const { getTemplate } = useVault()
  const color = RARITIES[card.rarity]?.color || '#9ca3af'
  const type = getCardType(card)
  const slotRef = useRef(null)

  useEffect(() => {
    if (!optionsOpen) return
    const handler = (e) => {
      if (slotRef.current && !slotRef.current.contains(e.target)) {
        onToggleOptions()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [optionsOpen, onToggleOptions])

  // Staff income display
  const cores = S5_STAFF_FLAT_CORES[card.rarity] || 0
  const mult = S5_STAFF_MULT[card.rarity] || 1

  return (
    <div className="relative" ref={slotRef}>
      {isAnimating && animConfig && (
        <SlotAnimationOverlay config={animConfig} rarity={card.rarity} />
      )}

      <div
        className="relative cursor-pointer transition-all"
        style={{
          ...(isAnimating ? { '--glow-color': `${color}66`, animation: 's5-glow-pulse 0.8s ease-in-out 2' } : {}),
          ...(!isAnimating ? { animation: 's5-card-enter 0.3s ease-out' } : {}),
        }}
        onClick={onToggleOptions}
      >
        {type === 'collection' ? (
          <VaultCard card={card} getTemplate={getTemplate} size={size} holo />
        ) : (
          <TradingCardHolo rarity={getHoloEffect(card.rarity)} role="STAFF" holoType={card.holoType || 'reverse'} size={size}>
            <GameCard type={type} rarity={card.rarity} data={toGameCardData(card, override)} size={size} />
          </TradingCardHolo>
        )}

        {optionsOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg overflow-hidden shadow-xl" style={{ minWidth: 130 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onZoom() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-[var(--cd-cyan)]/10 hover:text-[var(--cd-cyan)] transition-colors cursor-pointer cd-head tracking-wider"
            >
              <ZoomIn size={12} /> Zoom
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSwap() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-[var(--cd-cyan)]/10 hover:text-[var(--cd-cyan)] transition-colors cursor-pointer cd-head tracking-wider"
            >
              <ArrowRightLeft size={12} /> Swap
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer cd-head tracking-wider"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 text-center">
        <div className="text-[11px] font-bold text-white/70 truncate cd-head" style={{ maxWidth: size }}>
          {card.godName}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold cd-head" style={{ color }}>{RARITIES[card.rarity]?.name}</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1 text-[10px] cd-num text-white/40">
          {cores > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              {cores < 1 ? cores.toFixed(2) : cores.toFixed(1)}/d
            </span>
          )}
          {mult > 1 && (
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
              +{Math.round((mult - 1) * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* No attachment slots for staff cards */}
    </div>
  )
}
```

- [ ] **Step 7: Update CardPicker to handle staff slot selection**

The CardPicker modal opens when `pickerRole` is set. Currently it filters for `card_type === 'player'`. When `pickerRole` is `'cheerleader'` or `'staff'`, it should filter for `card_type === 'staff'` instead.

In the CardPicker component (line 1723), update the eligibility filter:

```javascript
  const isStaffSlot = role === 'cheerleader' || role === 'staff'

  const eligibleCards = useMemo(() => {
    const currentPlayerInSlot = slottedCards[role]?.id
    return collection
      .filter(card => {
        const type = getCardType(card)
        if (isStaffSlot) {
          if (type !== 'staff') return false
        } else {
          if (type !== 'player') return false
          if (!isBench) {
            const cardRole = (card.role || card.cardData?.role || '').toLowerCase()
            if (cardRole !== role && cardRole !== 'fill') return false
          }
          if (!card.holoType && card.rarity !== 'common') return false
        }
        if (card.id !== currentPlayerInSlot && allSlottedIds.has(card.id)) return false
        return true
      })
      .sort(byRarityThenIncome)
  }, [collection, slottedCards, allSlottedIds, role, isBench, isStaffSlot])
```

- [ ] **Step 8: Verify `executeSlot` works for staff slots**

`executeSlot` (line 325-339) calls `slotS5Card(cardId, role, 'player', activeLineup)` with hardcoded `slotType = 'player'`. This routes correctly into the backend `slotCard` function's `if (slotType === 'player')` branch, which then checks the role to determine if it's a staff slot. Semantically confusing but functionally correct — no change needed.

- [ ] **Step 9: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx src/data/vault/economy.js
git commit -m "feat(vault): staff slot UI in Starting 5 with card picker support"
```

---

### Task 8: Add 'staff' to card_type lists across the codebase

**Files:**
- Modify: `src/pages/vault/CCMarketplace.jsx:19`
- Modify: `src/pages/vault/bounty/CreateBountyForm.jsx:10`
- Modify: `src/pages/vault/bounty/BountyGrid.jsx:5`
- Modify: `functions/api/bounty.js:21`
- Modify: `src/pages/vault-dashboard/TemplatesPage.jsx:9`
- Modify: `src/pages/vault-dashboard/CardCreator.jsx:13`
- Modify: `src/pages/admin/PackCreator.jsx:5`

- [ ] **Step 1: Update marketplace CARD_TYPES**

At `src/pages/vault/CCMarketplace.jsx:19`:
```javascript
const CARD_TYPES = ['god', 'item', 'consumable', 'player', 'staff']
```

- [ ] **Step 2: Update bounty CreateBountyForm CARD_TYPES**

At `src/pages/vault/bounty/CreateBountyForm.jsx:10`:
```javascript
const CARD_TYPES = ['god', 'player', 'item', 'consumable', 'staff']
```

- [ ] **Step 3: Update bounty BountyGrid CARD_TYPES**

At `src/pages/vault/bounty/BountyGrid.jsx:5`:
```javascript
const CARD_TYPES = ['god', 'player', 'item', 'consumable', 'staff']
```

- [ ] **Step 4: Update backend bounty VALID_CARD_TYPES**

At `functions/api/bounty.js:21`:
```javascript
const VALID_CARD_TYPES = new Set(['god', 'item', 'consumable', 'player', 'staff'])
```

- [ ] **Step 5: Update admin TemplatesPage CARD_TYPES**

At `src/pages/vault-dashboard/TemplatesPage.jsx:9`:
```javascript
const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom', 'staff']
```

- [ ] **Step 6: Update admin CardCreator CARD_TYPES**

At `src/pages/vault-dashboard/CardCreator.jsx:13`:
```javascript
const CARD_TYPES = ['player', 'god', 'item', 'consumable', 'minion', 'buff', 'custom', 'staff']
```

- [ ] **Step 7: Update admin PackCreator CARD_TYPES**

At `src/pages/admin/PackCreator.jsx:5`:
```javascript
const CARD_TYPES = ['god', 'item', 'consumable', 'player', 'collection', 'staff']
```

- [ ] **Step 8: Do NOT add 'staff' to Black Market mythic claim list**

At `functions/api/vault.js` line 1854, the mythic claim handler uses `['god', 'item', 'consumable', 'player', 'minion']`. Staff cards are created through Vault Studio only, not claimable through the Black Market. Leave this unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/pages/vault/CCMarketplace.jsx src/pages/vault/bounty/CreateBountyForm.jsx src/pages/vault/bounty/BountyGrid.jsx functions/api/bounty.js src/pages/vault-dashboard/TemplatesPage.jsx src/pages/vault-dashboard/CardCreator.jsx src/pages/admin/PackCreator.jsx
git commit -m "feat(vault): recognize staff card_type across marketplace, bounty, and admin tools"
```

---

### Task 9: Update help text in Starting 5

**Files:**
- Modify: `src/pages/vault/CCStartingFive.jsx:1173-1236`

- [ ] **Step 1: Add staff slot help section**

After the "BENCH SLOT" help section (around line 1231), add:

```jsx
          <div>
            <h4 className="font-bold text-white/80 cd-head tracking-wider text-xs mb-1">STAFF SLOTS</h4>
            <p>Two staff slots (Cheerleader and Staff) are available in the current season lineup only. Slot staff-type cards to get a small Cores income bonus and multiplier boost. Staff cards cannot have attachments and don't count toward team synergy.</p>
          </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/vault/CCStartingFive.jsx
git commit -m "feat(vault): add staff slots help text to Starting 5"
```

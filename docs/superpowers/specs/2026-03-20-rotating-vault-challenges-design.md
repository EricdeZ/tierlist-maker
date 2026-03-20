# Rotating Vault Challenges — Design Spec

## Overview

Add daily, weekly, and monthly rotating challenges to the vault's challenge system. Each player gets a unique random selection from a template pool. Challenges reset on a fixed UTC schedule and can award Cores, challenge-packs, or both.

## Requirements

- **Daily**: 3 challenges (1 Cores-only, 1 pack-only, 1 mixed)
- **Weekly**: 4 challenges (2 Cores-only, 1 pack-only, 1 mixed)
- **Monthly**: 3 challenges (1 Cores-only, 1 pack-only, 1 mixed)
- Per-player random assignment from a shared template pool
- Progress tracked as delta within the period (not lifetime totals)
- Rewards: Cores via `grantEmber()`, packs via `cc_pack_inventory` insert (slug: `challenge-pack`)
- Resets at midnight UTC (daily), Monday 00:00 UTC (weekly), 1st 00:00 UTC (monthly)

## Architecture: Hybrid (New Tables + Existing Progress Pipeline)

New database tables keep the data model clean. The existing `pushChallengeProgress()` pipeline is extended to also update rotating challenge assignments, avoiding duplicate stat-tracking code.

## Data Model

### `cc_challenge_templates`

The pool of possible rotating challenges. Admin-managed, not per-user.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| title | text NOT NULL | e.g., "Quick Opener" |
| description | text NOT NULL | e.g., "Open 3 packs today" |
| cadence | text NOT NULL | `daily`, `weekly`, or `monthly` |
| reward_type | text NOT NULL | `cores`, `pack`, or `mixed` |
| reward_cores | integer | Cores awarded (NULL for pack-only) |
| reward_packs | integer DEFAULT 1 | Number of challenge-packs awarded (NULL for cores-only) |
| stat_key | text NOT NULL | Reuses existing keys from VAULT_KEYS (e.g., `packs_opened`) |
| target_value | integer NOT NULL | Delta target within the period |
| is_active | boolean DEFAULT true | Soft-disable without deleting |
| created_at | timestamptz DEFAULT NOW() | |

### `cc_challenge_assignments`

Per-user assignments for the current (and historical) periods.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | integer NOT NULL FK → users | |
| template_id | integer NOT NULL FK → cc_challenge_templates | |
| cadence | text NOT NULL | Denormalized from template for fast queries |
| period_start | timestamptz NOT NULL | Start of the daily/weekly/monthly period |
| period_end | timestamptz NOT NULL | Expiry timestamp |
| baseline_value | integer NOT NULL DEFAULT 0 | User's stat value at assignment time (for delta tracking) |
| current_value | integer NOT NULL DEFAULT 0 | Current delta progress |
| completed | boolean DEFAULT false | True when current_value >= target_value |
| claimed | boolean DEFAULT false | True after user claims the reward |
| created_at | timestamptz DEFAULT NOW() | |

**Unique constraint**: `(user_id, template_id, period_start)` — prevents duplicate assignments in the same period.

**Index**: `(user_id, period_end) WHERE claimed = false` — fast lookup of active assignments.

## Period Calculation

```
Daily:   today 00:00 UTC  →  tomorrow 00:00 UTC
Weekly:  this Monday 00:00 UTC  →  next Monday 00:00 UTC
Monthly: 1st of month 00:00 UTC  →  1st of next month 00:00 UTC
```

## Assignment Flow

Triggered on challenges page load (GET `action=rotating`):

1. For each cadence, calculate the current `period_start`. Query `cc_challenge_assignments` for user where `period_start = <current_period_start>` for that cadence. If any rows exist (claimed or not), that cadence is already assigned — skip.
2. For each cadence with no assignments for the current period:
   a. Calculate current period_start and period_end
   b. Query active templates for that cadence, grouped by reward_type
   c. Randomly select the required count per reward_type:
      - Daily: 1 cores, 1 pack, 1 mixed
      - Weekly: 2 cores, 1 pack, 1 mixed
      - Monthly: 1 cores, 1 pack, 1 mixed
   d. For each selected template, snapshot the user's current stat value as `baseline_value`
   e. Insert into `cc_challenge_assignments`
3. Return all assignments for current periods (including claimed ones to show completion state) with time remaining

If the pool doesn't have enough templates of a reward_type for a cadence, fill what's available (no error — just fewer challenges).

## Progress Tracking

### Extension to `pushChallengeProgress()`

After the existing permanent challenge update logic, add:

```
1. Query cc_challenge_assignments WHERE user_id = X
   AND period_end > NOW() AND claimed = false
   AND stat_key matches incoming keys (join with cc_challenge_templates)
2. For each matching assignment:
   new_delta = current_stat_value - baseline_value
   Update current_value = new_delta
   If new_delta >= target_value AND not already completed:
     Mark completed = true
     Add to newly_claimable list
3. Return newly_claimable (merged with permanent challenge results)
```

The stat_key join goes through `cc_challenge_templates` via `template_id`. This is a single query + single bulk update, keeping the query budget low.

## Claiming

New POST action `action=claim-rotating` on the challenges endpoint.

**Request body**: `{ assignmentId: number }`

**Flow** (wrapped in `transaction()` for atomicity since mixed rewards grant two resources):
1. Validate: assignment belongs to user, completed = true, claimed = false, not expired
2. Based on reward_type from the joined template:
   - **cores**: `grantEmber(sql, userId, 'rotating_challenge', reward_cores, title, String(assignmentId))`
   - **pack**: Insert `reward_packs` rows into `cc_pack_inventory` with `pack_type_id` = challenge-pack's ID, `source = 'challenge'`
   - **mixed**: Both of the above
3. Set `claimed = true`
4. Return: `{ success, coresEarned, packsEarned, emberBalance }`

**Expiry grace period**: Completed but unclaimed assignments remain claimable for 1 hour after `period_end`. After that, they show as "Expired" in the UI and cannot be claimed. This prevents the frustrating scenario of completing a challenge right before reset and missing the claim window.

## API Changes

### GET `/api/challenges?action=rotating`

Returns current rotating assignments, rolling new ones if needed.

**Response**:
```json
{
  "daily": {
    "challenges": [...],
    "resetsAt": "2026-03-21T00:00:00Z"
  },
  "weekly": {
    "challenges": [...],
    "resetsAt": "2026-03-23T00:00:00Z"
  },
  "monthly": {
    "challenges": [...],
    "resetsAt": "2026-04-01T00:00:00Z"
  }
}
```

Each challenge object (`assignmentId` is the `cc_challenge_assignments.id`, used for claiming):
```json
{
  "assignmentId": 42,
  "title": "Quick Opener",
  "description": "Open 3 packs today",
  "rewardType": "cores",
  "rewardCores": 15,
  "rewardPacks": null,
  "statKey": "packs_opened",
  "targetValue": 3,
  "currentValue": 1,
  "completed": false,
  "claimed": false
}
```

### POST `/api/challenges?action=claim-rotating`

Claims a completed rotating challenge. Body: `{ assignmentId }`.

## UI Changes

### CCChallenges.jsx

Add a new section **above** the existing permanent challenges:

**"Rotating Challenges"** header with three tab groups: Daily | Weekly | Monthly

Each tab shows:
- **Countdown timer** until reset (e.g., "Resets in 5h 23m") — updates every minute
- **Challenge cards** in the same visual style as existing `VaultChallengeCard`, with:
  - Progress bar (current_value / target_value)
  - Reward display: Cores icon + amount, and/or pack icon + count
  - Claim button when completed
  - "Completed" badge when claimed
- **Empty state** if no templates exist for a cadence

The existing "Core Challenges" (permanent) section moves below, separated by a divider or header change.

### New pack icon

The reward display needs a pack icon alongside the existing Cores icon for pack-only and mixed rewards. Reuse an existing asset or add a small pack SVG.

## Novel Objectives (Future)

The system supports adding new stat keys incrementally. Potential additions:
- `rare_plus_pulled` — cards of rare+ rarity from packs (new counter in cc_stats)
- `quick_trade` — trades completed within 1 hour

These are not in scope for the initial implementation. The template pool will use existing VAULT_KEYS stat keys with period-appropriate targets.

## Stat Key Constraints

**Only monotonically increasing stat keys are valid for rotating challenges.** Gauge stats like `total_cards_owned`, `unique_gods_owned`, `legendary_cards_owned`, `starting_five_filled`, etc. can decrease (via dismantling, selling, trading) which breaks delta tracking. Allowed keys:

`packs_opened`, `cards_dismantled`, `legendary_cards_dismantled`, `trades_completed`, `marketplace_sold`, `marketplace_bought`, `gifts_sent`, `gifts_opened`, `cores_converted`, `daily_cores_claimed`, `income_collected`, `total_cores_earned`, `total_cores_spent`, `marketplace_volume`, `bounty_cores_earned`

## Example Template Pool (Initial)

### Daily (target values tuned for single-day completion)
| Title | stat_key | target | reward_type | cores | packs |
|-------|----------|--------|-------------|-------|-------|
| Quick Opener | packs_opened | 2 | cores | 15 | - |
| Daily Dismantler | cards_dismantled | 5 | cores | 10 | - |
| Core Collector | daily_cores_claimed | 1 | cores | 10 | - |
| Converter | cores_converted | 2 | cores | 20 | - |
| Pack Prize | packs_opened | 3 | pack | - | 1 |
| Trade for Packs | trades_completed | 1 | pack | - | 1 |
| Market Seller | marketplace_sold | 2 | pack | - | 1 |
| Lucky Opener | packs_opened | 4 | mixed | 10 | 1 |
| Generous Trader | gifts_sent | 1 | mixed | 10 | 1 |
| Salvage & Earn | cards_dismantled | 8 | mixed | 15 | 1 |

### Weekly
| Title | stat_key | target | reward_type | cores | packs |
|-------|----------|--------|-------------|-------|-------|
| Weekly Opener | packs_opened | 10 | cores | 40 | - |
| Marketplace Regular | marketplace_sold | 8 | cores | 35 | - |
| Dismantle Spree | cards_dismantled | 25 | cores | 30 | - |
| Core Hoarder | daily_cores_claimed | 5 | cores | 50 | - |
| Trade Master | trades_completed | 3 | pack | - | 2 |
| Gift Giver | gifts_sent | 3 | pack | - | 2 |
| Big Spender | packs_opened | 15 | mixed | 30 | 2 |
| Social Butterfly | gifts_sent | 2 | mixed | 25 | 1 |

### Monthly
| Title | stat_key | target | reward_type | cores | packs |
|-------|----------|--------|-------------|-------|-------|
| Monthly Marathon | packs_opened | 40 | cores | 100 | - |
| Market Mogul | marketplace_sold | 30 | cores | 80 | - |
| Salvage King | cards_dismantled | 80 | pack | - | 3 |
| Bounty Hunter | bounty_cores_earned | 200 | pack | - | 3 |
| Pack Legend | packs_opened | 60 | mixed | 75 | 3 |
| Trading Empire | trades_completed | 10 | mixed | 60 | 2 |
| Core Machine | cores_converted | 20 | mixed | 50 | 2 |

## Template Deactivation

If an admin sets `is_active = false` on a template mid-period, existing assignments should still be completable and claimable. The progress query joins on `cc_challenge_templates` but does NOT filter by `is_active` — only the assignment-rolling query filters by `is_active`. This means `stat_key` and `target_value` are read from the template at query time (not denormalized), but deactivated templates are excluded from future rolls only.

## Migration

Single SQL migration file:
1. Create `cc_challenge_templates` table
2. Create `cc_challenge_assignments` table with unique constraint + partial index
3. Ensure `challenge-pack` pack type exists in `cc_pack_types` (the user has already created this — verify it exists, and if not, insert with appropriate config)
4. Seed initial template pool

## Files Changed

| File | Change |
|------|--------|
| `functions/lib/challenges.js` | Extend `pushChallengeProgress()` to update rotating assignments |
| `functions/api/challenges.js` | Add `action=rotating` (GET) and `action=claim-rotating` (POST) |
| `src/pages/vault/CCChallenges.jsx` | Add rotating challenges section above permanent challenges |
| `src/services/database.js` | Add `getRotating()` and `claimRotating()` to challengeService |
| `migrations/XXX-rotating-challenges.sql` | New tables + seed data |

# Staff Pack Design Spec

## Overview

Add a new "Staff Pack" to the vault shop that guarantees 2 staff cards with boosted rarity odds, 1 player card, 2 random god/item/consumable cards, and 1 wildcard slot. Priced at 10 Cores, permanent in the shop (not rotation-only).

## Pack Definition

New pack type `staff-mixed` in `cc_pack_types`:

| Field | Value |
|-------|-------|
| id | `staff-mixed` |
| name | Staff Pack |
| cost | 10 |
| cards_per_pack | 6 |
| category | `configured` |
| enabled | true |
| rotation_only | false |

### Slots

All 5 main slots share group `A` — the configured pack generator distributes the 2 staff + 1 player randomly across them. Slot 5 (index 4) has uncommon minimum rarity (the highlighted "rarest" slot in the pack opening UI). Slot 6 is an ungrouped wildcard.

```json
[
  {"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},
  {"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},
  {"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},
  {"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"common"},
  {"types":["god","item","consumable","player","staff"],"group":"A","minRarity":"uncommon"},
  {"types":["god","item","consumable","player","staff"],"group":"W","minRarity":"common"}
]
```

### Group Constraints

```json
{"A": [{"type":"staff","min":2,"max":2}, {"type":"player","min":1,"max":1}]}
```

### Odds Config with typeOdds

Staff cards in this pack use boosted rarity weights. Non-staff cards use normal base odds.

```json
{
  "typeOdds": {
    "staff": {
      "rarity": {
        "common": 0.55,
        "uncommon": 0.30,
        "rare": 0.08,
        "epic": 0.05,
        "legendary": 0.01,
        "mythic": 0.004,
        "unique": 0.001
      }
    }
  }
}
```

Comparison to base odds:

| Rarity | Base | Staff (this pack) |
|--------|------|--------------------|
| Common | 60% | 55% |
| Uncommon | 30% | 30% |
| Rare | 6% | 8% |
| Epic | 3.5% | 5% |
| Legendary | 0.65% | 1% |
| Mythic | 0.075% | 0.4% |
| Unique | 0.035% | 0.1% |

## Staff Card Generation

Currently staff cards only come from collection blueprints via `generateCollectionCard`. The configured pack generator has no `staff` case in `generateCardByType` — it falls through to god card generation.

### New: `generateStaffCard(sql, rarity, ctx)`

- Queries `cc_card_blueprints` where `card_type = 'staff'` and `status = 'approved'`
- Picks one randomly (with Collector Boost weighting via `selectFromPool` if applicable)
- Returns card object matching the shape from `generateCollectionCard` (god_id, god_name, blueprint_id, depicted_user_id, etc.)
- Fallback: if no approved staff blueprints exist, generates a god card instead

### Wiring

1. **`generateCardByType`** — add `case 'staff'` that calls `generateStaffCard`. Function becomes async since staff generation requires a DB query.
2. **`generateConfiguredPack`** — handle `type === 'staff'` in the card generation branch alongside existing `player` and `collection` handling.

## typeOdds in Odds Engine

### Changes to `functions/lib/odds.js`

- `applyPackOverrides(ctx, oddsConfig)` — when `oddsConfig.typeOdds` exists, store it on `ctx.typeOdds`
- New function: `getContextForType(ctx, type)` — returns a shallow copy of ctx with type-specific rarity weights applied from `ctx.typeOdds[type]` if present, otherwise returns ctx unchanged

### Usage in `generateConfiguredPack`

Before rolling rarity for each card, call `getContextForType(ctx, type)` to get the type-appropriate odds context. This keeps the per-type override scoped to the pack's `odds_config` — no global changes.

## Migration

Single SQL migration to insert the pack type with slots, group_constraints, and odds_config.

## Files Changed

| File | Change |
|------|--------|
| `functions/lib/odds.js` | Add `typeOdds` support to `applyPackOverrides`, add `getContextForType` |
| `functions/lib/vault.js` | Add `generateStaffCard`, wire into `generateCardByType` + `generateConfiguredPack` |
| `database/migrations/XXX-staff-pack.sql` | Insert `staff-mixed` pack type |

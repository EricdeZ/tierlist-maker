# Starting 5 Reward System Redesign

## Problem

Holo cards are undesirable because they only generate Passion, which players don't value. Reverse cards (Cores only) dominate the meta. Full cards try to do both but are mediocre. The system needs a redesign where all card types generate both currencies, holo cards become essential, and the overall economy shifts toward rewarding higher rarity more aggressively.

## Design Summary

Replace the current "holo type determines currency" model with a "holo type determines economic role" model:

- **Holo** = flat income (Cores + small Passion per day)
- **Reverse** = multiplier (multiplicatively stacks with other reverse cards)
- **Full** = 44% of both flat and multiplier (jack of all trades, master of neither)

Total output = (sum of all flat values) x (product of all multipliers)

Common cards (holo_type = NULL) still earn nothing — unchanged from current system.

All-reverse lineups produce zero income (nothing to multiply). Holo cards become the essential base income generators.

## Core Mechanic

### Sweet Spot

The multiplier value is tuned so the optimal split between holo and reverse is at exactly 2.5 cards at the anchor rarity (Legendary, M=1.50). This means 3+2 and 2+3 produce identical output.

At lower rarities (M < 1.50), the sweet spot favors more holo cards. At higher rarities (M > 1.50), it shifts toward more reverse. This creates natural progression:

- **Early game** (uncommon/rare): Load up on holo, reverse barely matters
- **Mid game** (epic): Start mixing in reverse cards
- **Endgame** (legendary): Perfect 2.5 balance
- **Whale tier** (mythic/unique): Lean into fewer but stronger multipliers

### Multiplier Stacking

Reverse cards stack **multiplicatively**. Each reverse card's multiplier is applied independently:

- 1 reverse card at 1.50x = 1.50x total
- 2 reverse cards at 1.50x = 1.50 x 1.50 = 2.25x total
- 3 reverse cards at 1.50x = 1.50^3 = 3.375x total

In mixed-rarity lineups, each card uses its own rarity's multiplier: a legendary reverse (1.50x) and a mythic reverse (1.65x) produce 1.50 x 1.65 = 2.475x.

### Viability of Non-Optimal Builds (5 Starters, Legendary)

| Build | Output | % of Optimal |
|---|---:|---:|
| 3H+2R (optimal, tied) | 6.75F | 100% |
| 2H+3R (optimal, tied) | 6.75F | 100% |
| 4H+1R | 6.00F | 89% |
| 5H+0R (all holo) | 5.00F | 74% |
| 1H+4R | 5.06F | 75% |
| 0H+5R (all reverse) | 0 | 0% |

All-holo is viable at 74%. All-reverse is dead.

## Player Card Values

### Flat Values (per card, per day)

| Rarity | Flat Cores | Flat Passion | Reverse Mult | Full Flat Cores | Full Flat Passion | Full Mult |
|---|---:|---:|---:|---:|---:|---:|
| Uncommon | 0.80 | 0.05 | 1.15x | 0.35 | 0.02 | 1.066x |
| Rare | 1.90 | 0.12 | 1.25x | 0.84 | 0.05 | 1.110x |
| Epic | 3.50 | 0.22 | 1.40x | 1.54 | 0.10 | 1.176x |
| Legendary | 7.60 | 0.47 | 1.50x | 3.34 | 0.21 | 1.220x |
| Mythic | 8.75 | 0.54 | 1.65x | 3.85 | 0.24 | 1.286x |
| Unique | 10.10 | 0.63 | 1.85x | 4.44 | 0.28 | 1.374x |

Full card values: 44% of holo flat, mult = 1 + 0.44 x (M - 1). All values rounded to 2 decimal places for flat, 3 for multipliers.

### How It Adds Up (Player-Facing Breakdown)

The flat numbers look small on their own — that's the point. Multipliers are where the power comes from. Here's what a lineup actually produces at each rarity:

**Example: 3 Holo + 2 Reverse starters (optimal at Legendary)**

| Rarity | 3x Holo Flat | 2x Reverse Mult | Base Output | Per Card Avg |
|---|---:|---:|---:|---:|
| Uncommon | 3 x 0.80 = 2.40 | 1.15 x 1.15 = 1.32x | **3.17** | 0.63 |
| Rare | 3 x 1.90 = 5.70 | 1.25 x 1.25 = 1.56x | **8.91** | 1.78 |
| Epic | 3 x 3.50 = 10.50 | 1.40 x 1.40 = 1.96x | **20.58** | 4.12 |
| Legendary | 3 x 7.60 = 22.80 | 1.50 x 1.50 = 2.25x | **51.30** | 10.26 |
| Mythic | 3 x 8.75 = 26.25 | 1.65 x 1.65 = 2.72x | **71.44** | 14.29 |
| Unique | 3 x 10.10 = 30.30 | 1.85 x 1.85 = 3.42x | **103.66** | 20.73 |

**Then the layers stack on top:**

| Layer | Legendary Example |
|---|---:|
| Base (3H + 2R) | 51.30 Cores/day |
| + Bench (reverse, 50%) | 64.13 |
| + Attachments (~2.2x) | 140.30 |
| + Team Synergy (+20%) | 168.36 |
| + Consumable (3x mythic) | **505 Cores/day** |
| + All-Star lineup | **816 Cores/day** |

**What each card type contributes to YOUR lineup:**

| Card Type | What It Does | Why You Want It |
|---|---|---|
| Holo | Generates 7.60 Cores/day flat (at Legendary) | Without flat income, multipliers have nothing to multiply. More holo = bigger base. |
| Reverse | Multiplies ALL flat income by 1.50x (at Legendary) | Two reverse cards = 2.25x your entire flat pool. Huge scaling. |
| Full | Adds 3.34 flat + 1.22x mult (at Legendary) | Flexible filler — covers both roles at 44% effectiveness. |

**The takeaway:** A single Legendary holo card looks like "only" 7.60 Cores/day. But paired with 2 reverse cards (2.25x), a bench card, attachments, team synergy, and a consumable — that 7.60 becomes part of a 505 Cores/day engine. The small flat number is the seed; everything else is the growth.

### Combined Output vs Current System

| Rarity | Current System | New System (combined) | Change |
|---|---:|---:|---:|
| Uncommon | 100% | 70% | -30% |
| Rare | 100% | 85% | -15% |
| Epic | 100% | 100% | same |
| Legendary | 100% | 130% | +30% |
| Mythic | 100% | 140% | +40% |
| Unique | 100% | 175% | +75% |

Baseline: "100% = current system" is the optimal all-reverse lineup at that rarity, fully loaded (attachments + team synergy + mythic consumable). The new system's "combined" is both lineups (CS + All-Star) with bench, fully loaded.

Lower rarities earn less than today. Higher rarities earn more. This rewards rarity progression more aggressively.

### Passion

Passion flat values are ~6% of Cores flat values. The same multiplier chain applies to both currencies, so Passion output is always a small consistent drip (~6% of Cores) regardless of lineup composition.

Target: ~50-60 Passion/day fully stacked at Legendary. The staff card (TBD) can bridge to 60.

## Two Lineups

### Structure

| Lineup | Modifier | Purpose |
|---|---:|---|
| Current Season | 1.0x | Primary earner |
| All-Star | 0.615x | Secondary earner |

Both lineups accept any card regardless of season — the names are thematic, not eligibility filters. Any player/god/item card can go in either lineup. Each lineup is calculated independently. Results are combined into a single Passion/Cores pool with a shared cap.

### Per Lineup Slots

- 5 starter slots (role-locked: solo/jungle/mid/support/adc)
- 1 bench slot (any role, 50% effectiveness on all contributions)
- 1 staff slot (unique bonus, TBD — see Staff Card section)

### Card Exclusivity

Cards cannot be slotted in both lineups simultaneously. A card is locked to one lineup. This doubles card demand and drives collecting.

### Consumable

One shared consumable slot applies to the combined total from both lineups. Same consumable types and spread ratios as the current system (Health Potion, Mana Potion, Multi Potion, Elixir of Strength, Elixir of Intelligence, Vision Ward, Sentry Ward). Rarity scaling unchanged.

## Bench Slot

The bench is a 6th player slot with no role restriction. It operates at 50% effectiveness:

- **Bench holo:** Adds 0.5 x F to the flat pool
- **Bench reverse:** Multiplier = 1 + 0.5 x (M - 1). At Legendary: 1.25x instead of 1.50x
- **Bench full:** 50% of the full card's already-reduced contributions
- **Bench attachments:** Also operate at 50% effectiveness

### Optimal with Bench (Legendary)

Three equally-optimal configurations (all produce 8.4375F = 64.1 Cores/day base):

- 2H + 3R starters + holo bench
- 3H + 2R starters + reverse bench
- 2H + 3R starters + reverse bench

Players have flexibility in how they fill the bench.

## Staff Card

A new card type (not yet in circulation). Provides a unique bonus distinct from flat/mult income — possibilities include cap increase, team synergy boost, claim cooldown reduction, or passive Passion drip.

The base system (starters + bench) is tuned to leave ~10-15% headroom below the final target output. The staff card fills this gap, making it a meaningful progression milestone without being mandatory.

Exact staff card design is TBD and will be specified separately.

## Attachments

### Mechanic Change

Attachment holo type no longer determines which currency is boosted. Instead it determines which economic dimension is amplified:

- **Holo attachment:** Percentage boost to the slot's flat contribution
- **Reverse attachment:** Flat additive amount to the slot's multiplier
- **Full attachment:** Both at 60% effectiveness (FULL_HOLO_RATIO = 0.6)

### Matching Requirement

Attachments boost the dimension they match:
- Holo attachment on holo player = boosts flat income (full benefit)
- Reverse attachment on reverse player = boosts multiplier (full benefit)
- Holo attachment on full player = boosts the 44% flat portion (works, but small base)
- Reverse attachment on full player = boosts the 44% mult portion (works, but small base)
- Holo attachment on reverse player = no flat to boost = 0 benefit
- Reverse attachment on holo player = no mult to boost = 0 benefit

Full attachments work on any player type (boosting whichever dimension exists) at 60% effectiveness.

This creates a matching game: players want holo attachments on holo players and reverse attachments on reverse players.

### God Synergy

God synergy (god card's god_name matches player card's best_god_name) provides +30% to the attachment's bonus, same as current system. Applies to both flat % boosts and mult additive amounts.

### Attachment Rarity Scaling

| Att. Rarity | Holo God (flat %) | Holo Item (flat %) | Rev God (+mult) | Rev Item (+mult) |
|---|---:|---:|---:|---:|
| Uncommon | +6% | +4% | +0.030 | +0.015 |
| Rare | +10% | +6% | +0.050 | +0.025 |
| Epic | +16% | +10% | +0.080 | +0.040 |
| Legendary | +25% | +15% | +0.125 | +0.060 |
| Mythic | +35% | +22% | +0.175 | +0.085 |
| Unique | +48% | +30% | +0.240 | +0.120 |

Full attachment bonuses: 60% of the matching pure type's values.

### Attachment Multiplier

The attachment layer provides approximately 2.2x amplification (vs 2.7x in current system). Smaller per-attachment because the multiplicative reverse stacking compounds attachment bonuses — larger values would blow past the output cap.

## Team Synergy

Same brackets as current system, applied as a global multiplier on each lineup's final output:

| Same-Team Cards | Bonus |
|---:|---:|
| 2 | +10% |
| 3 | +20% |
| 4 | +35% |
| 5 | +50% |

Applied independently to each lineup (Current Season and All-Star have their own team synergy). Team synergy counts starters only (5 cards max) — the bench does not count toward team synergy.

## Calculation Pseudocode

```
function calculateLineupOutput(lineup, lineupModifier):
  // Step 1: Per-slot contributions (with attachments)
  totalFlatCores = 0
  totalFlatPassion = 0
  totalMult = 1.0

  for each slot in lineup.starters + lineup.bench:
    effectiveness = (slot == bench) ? 0.5 : 1.0
    card = slot.playerCard
    god = slot.godCard
    item = slot.itemCard

    if card.holo_type == 'holo':
      flatC = FLAT_CORES[card.rarity] * effectiveness
      flatP = FLAT_PASSION[card.rarity] * effectiveness
      // Holo/full attachments boost flat (multiplicative per attachment)
      flatC *= getAttFlatMult(god, card, 'cores') * getAttFlatMult(item, card, 'cores')
      flatP *= getAttFlatMult(god, card, 'passion') * getAttFlatMult(item, card, 'passion')
      totalFlatCores += flatC
      totalFlatPassion += flatP

    else if card.holo_type == 'reverse':
      baseMult = REVERSE_MULT[card.rarity]
      multBonus = (baseMult - 1) * effectiveness  // e.g., 0.50 * 0.5 = 0.25 for bench
      // Reverse/full attachments add to mult (additive per attachment)
      multBonus += getAttMultAdd(god, card) * effectiveness
      multBonus += getAttMultAdd(item, card) * effectiveness
      totalMult *= (1 + multBonus)

    else if card.holo_type == 'full':
      // 44% of both dimensions
      flatC = FLAT_CORES[card.rarity] * 0.44 * effectiveness
      flatP = FLAT_PASSION[card.rarity] * 0.44 * effectiveness
      flatC *= getAttFlatMult(god, card, 'cores') * getAttFlatMult(item, card, 'cores')
      flatP *= getAttFlatMult(god, card, 'passion') * getAttFlatMult(item, card, 'passion')
      totalFlatCores += flatC
      totalFlatPassion += flatP

      baseMult = REVERSE_MULT[card.rarity]
      multBonus = (baseMult - 1) * 0.44 * effectiveness
      multBonus += getAttMultAdd(god, card) * effectiveness
      multBonus += getAttMultAdd(item, card) * effectiveness
      totalMult *= (1 + multBonus)

  // Step 2: Combine flat x mult
  rawCores = totalFlatCores * totalMult
  rawPassion = totalFlatPassion * totalMult

  // Step 3: Team synergy (starters only, not bench)
  teamBonus = getTeamSynergyBonus(lineup.starters)
  rawCores *= (1 + teamBonus)
  rawPassion *= (1 + teamBonus)

  // Step 4: Lineup modifier
  return { cores: rawCores * lineupModifier, passion: rawPassion * lineupModifier }

function calculateCombined(csLineup, asLineup, consumable):
  cs = calculateLineupOutput(csLineup, 1.0)
  as = calculateLineupOutput(asLineup, 0.615)

  unboostedCores = cs.cores + as.cores
  unboostedPassion = cs.passion + as.passion

  // Consumable boosts combined total
  coresBoost = consumable.scaling * consumable.coresSpread
  passionBoost = consumable.scaling * consumable.passionSpread

  boostedCores = unboostedCores * (1 + coresBoost)
  boostedPassion = unboostedPassion * (1 + passionBoost)

  // Cap based on unboosted rate x 2 days
  coresCap = unboostedCores * 2
  passionCap = unboostedPassion * 2

  return { boostedCores, boostedPassion, coresCap, passionCap }
```

### Attachment Helper Functions

```
function getAttFlatMult(attachment, playerCard, currency):
  // Returns multiplier for flat income (>= 1.0)
  if attachment == null: return 1.0
  if playerCard has no flat component: return 1.0  // reverse player

  bonus = ATT_FLAT_BONUS[attachment.rarity][currency]  // e.g., 0.25 at legendary
  if attachment.holo_type == 'full': bonus *= 0.6
  else if attachment.holo_type == 'reverse': return 1.0  // no flat boost
  if isGodSynergy(attachment, playerCard): bonus *= 1.3
  return 1 + bonus

function getAttMultAdd(attachment, playerCard):
  // Returns additive amount for multiplier (>= 0)
  if attachment == null: return 0
  if playerCard has no mult component: return 0  // holo player

  isGod = (attachment.card_type == 'god')
  bonus = isGod ? ATT_MULT_GOD[attachment.rarity] : ATT_MULT_ITEM[attachment.rarity]
  if attachment.holo_type == 'full': bonus *= 0.6
  else if attachment.holo_type == 'holo': return 0  // no mult boost
  if isGod and isGodSynergy(attachment, playerCard): bonus *= 1.3
  return bonus
```

## Cap Mechanics

- 2-day cap based on unboosted combined rate (sum of both lineups, before consumable)
- Both lineups contribute to a single shared cap pool
- Consumable makes you reach cap faster, requiring more frequent claims
- Integer amounts collected on claim, remainder stays pending (same as current)

## Output Scenarios

### Scenario A: Optimal Current Season (Legendary, fully loaded)

Config: 3H + 2R starters + reverse bench, all legendary attachments (god with synergy + item), 3 same team, mythic elixir of intelligence consumable.

| Layer | Cores/day |
|---|---:|
| Base (3H+2R+Rbench) | 64.1 |
| + Attachments (2.2x) | 140.3 |
| + Team synergy (1.2x) | 168.4 |
| + Consumable (3x) | **505** |

### Scenario B: Combined Both Lineups (Legendary)

| Component | Cores/day | Passion/day |
|---|---:|---:|
| Current Season | 505 | 31 |
| All-Star (x0.615) | 311 | 19 |
| **Combined** | **816** | **~50** |
| Current system | 734 | varies |
| **Change** | **+11%** | — |

Staff card headroom brings this to ~125-130% of current.

### Scenario C: All-Holo Lineup (Legendary)

5H + holo bench, all attachments, team synergy. No reverse cards.

- Output: ~77 Cores/day (pre-consumable)
- vs optimal: 45% fully loaded, 74% at base
- Still earns meaningful income — viable for players without reverse cards

### Scenario D: Mid-Tier (Epic)

3H + 2R at Epic, partial attachments, epic consumable.

- Combined output roughly matches current epic lineup (~367 Cores/day)
- Epic is the breakeven tier — same as today

## Migration Considerations

- All existing Starting 5 lineups need recalculation under new rates
- Players with all-reverse lineups will earn zero until they slot holo cards — needs clear communication
- Pending income at migration should be collected or preserved
- Card values don't change (rarity, holo type unchanged) — only the reward interpretation changes
- Consider a grace period or auto-unslot with notification

## Key Design Properties

1. **Holo cards are now essential** — the most important cards in the system, reversing the current dynamic
2. **Reverse cards are powerful amplifiers** — but useless alone, creating interdependence
3. **Full cards are flexible but suboptimal** — good for filling gaps, not for optimizing
4. **Natural progression** — optimal strategy evolves as you get higher rarity cards
5. **Attachment matching matters** — creates demand for specific holo-type god/item cards
6. **Both lineups reward deep collections** — card exclusivity doubles demand
7. **Staff card headroom** — system is tuned below target to leave room for future staff card design

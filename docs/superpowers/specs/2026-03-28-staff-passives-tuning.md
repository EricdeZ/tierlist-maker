# Staff Passives — Tuning Tables

All passives activate only when the staff card is slotted in the **staff** Starting 5 slot. Only one staff slot exists. Values scale by the staff card's rarity.

---

## Odds Boost

Multiplier applied to all non-common rarity weights during pack opening.

| Staff Rarity | Multiplier |
|-------------|-----------|
| uncommon | 1.05x |
| rare | 1.10x |
| epic | 1.18x |
| legendary | 1.28x |
| mythic | 1.40x |
| unique | 1.55x |

---

## Holo Boost

User selects a holo type (holo/reverse/full) when slotting the card. That type's weight increases while others stay at 1.0 (base is 1/1/1 = 33% each).

| Staff Rarity | Chosen Type Weight | Other Types |
|-------------|-------------------|-------------|
| uncommon | 1.5 | 1.0 each |
| rare | 2.0 | 1.0 |
| epic | 3.0 | 1.0 |
| legendary | 4.5 | 1.0 |
| mythic | 6.0 | 1.0 |
| unique | 8.0 | 1.0 |

---

## Card Reroll

Charge-based. After flipping a card during pack opening, a reroll button appears (if charges available). Can only target cards at or below the staff card's rarity.

| Staff Rarity | Hours/Charge | Max Charges |
|-------------|-------------|-------------|
| uncommon | 48 | 1 |
| rare | 36 | 2 |
| epic | 24 | 2 |
| legendary | 18 | 3 |
| mythic | 12 | 3 |
| unique | 8 | 4 |

---

## Pack Reroll

Charge-based. Reroll the entire pack after flipping (same rarities). Each reroll removes 1 random card — higher rarity staff cards bias the removal toward lower-rarity cards. Multiple rerolls per charge allowed, but each successive reroll increases the chance of losing the rarest card by +15%.

| Staff Rarity | Hours/Charge | Max Charges | Low-Card-Loss Bias |
|-------------|-------------|-------------|-------------------|
| uncommon | 72 | 1 | 0.45 |
| rare | 48 | 1 | 0.50 |
| epic | 36 | 2 | 0.55 |
| legendary | 24 | 2 | 0.62 |
| mythic | 18 | 3 | 0.70 |
| unique | 12 | 3 | 0.75 |

**Low-Card-Loss Bias** = probability the removed card comes from the bottom half of the pack's rarity spread.

---

## Unique Hunter

Toggle (enable/disable in Starting 5 passive UI). Blocks legendary and mythic pulls entirely. Their combined probability is redistributed: X% funneled into unique chance, the remainder spread back to lower rarities.

| Staff Rarity | % of Blocked Odds → Unique |
|-------------|---------------------------|
| uncommon | 15% |
| rare | 25% |
| epic | 35% |
| legendary | 50% |
| mythic | 65% |
| unique | 80% |

---

## Collector Boost

Weights card pool selection toward definitions the user doesn't already own. The multiplier is applied to un-owned card definitions during pool selection (owned cards stay at 1.0x weight).

| Staff Rarity | Un-owned Weight Multiplier |
|-------------|--------------------------|
| uncommon | 1.5x |
| rare | 2.0x |
| epic | 3.0x |
| legendary | 4.5x |
| mythic | 6.5x |
| unique | 9.0x |

---

## Card Generator

Charge-based. Generates claimable mini-packs (single card) in the Starting 5 UI. Pulls from all available card definitions, capped at the staff card's rarity. Uses boosted odds (equivalent Odds Boost multiplier applied to the generation roll).

| Staff Rarity | Hours/Charge | Max Charges | Rarity Cap |
|-------------|-------------|-------------|-----------|
| uncommon | 72 | 1 | uncommon |
| rare | 48 | 2 | rare |
| epic | 36 | 2 | epic |
| legendary | 24 | 3 | legendary |
| mythic | 16 | 3 | mythic |
| unique | 10 | 4 | unique |

---

## Swap Cooldown

When removing a staff card from the staff slot, a global cooldown prevents slotting another card. Duration depends on the passive of the card being removed.

| Passive | Cooldown |
|---------|---------|
| Odds Boost | 12h |
| Holo Boost | 12h |
| Card Reroll | 24h |
| Pack Reroll | 24h |
| Unique Hunter | 6h |
| Collector Boost | 12h |
| Card Generator | 48h |

Card Generator has the longest cooldown because it has persistent state (accumulated charge progress).

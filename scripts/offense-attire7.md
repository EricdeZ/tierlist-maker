# Offense File: attire7 Alt Network

**Date:** 2026-03-30
**Severity:** Tier 1 (Banworthy) — Multi-alt gift farming + trade washing at scale
**Recommendation:** Ban all 4 alt accounts. Action on main account at admin discretion.

---

## 1. Summary

**attire7** operates a network of 4 alt accounts from the same household IP to systematically farm gift packs and funnel cards/Cores to the main account. Two alts (ziveno, vincetm) are high-volume gift feeders and exclusive trade partners. Two alts (corncutoff, thetower0226) are throwaway fresh-Discord accounts created solely to receive free gifts — they share the **exact same browser fingerprint** as ziveno, confirming single-operator control.

**Scale of abuse:**
- 515 gift packs received by attire7 from the network
- 195 exclusive trades funneling cards to attire7
- 2,782 cards accumulated (20 mythic, 89 legendary)
- 9,663 Ember balance
- Active marketplace flipping operation fueled by alt-farmed inventory

---

## 2. The Cluster

### Main Account: attire7
| Field | Value |
|-------|-------|
| User ID | 1851 |
| Discord ID | 432042983500546068 |
| Discord created | 2018-04-07 (old account) |
| Site joined | 2026-03-13 |
| Linked player | NONE |
| Packs opened | 1,560 |
| W/L | 0/0 |
| Ember balance | 9,663 |
| Cards | 2,782 (977 common, 1045 uncommon, 195 rare, 455 epic, 89 legendary, 20 mythic, 1 unique) |
| Devices | 4 different fingerprints (rotating browsers) |

### Alt 1: ziveno
| Field | Value |
|-------|-------|
| User ID | 2421 |
| Discord ID | 1161846416428249139 |
| Discord created | 2023-10-12 |
| Site joined | 2026-03-17 |
| Linked player | NONE |
| Packs opened | 684 |
| W/L | 0/0 |
| Ember balance | 2,666 |
| Cards remaining | 179 |
| Device | a486dc98-5a26-4edd-b31a-318d1edde287 |

### Alt 2: vincetm
| Field | Value |
|-------|-------|
| User ID | 2558 |
| Discord ID | 1166741793522593875 |
| Discord created | 2023-10-25 |
| Site joined | 2026-03-17 |
| Linked player | NONE |
| Packs opened | 596 |
| W/L | 0/0 |
| Ember balance | 2,358 |
| Cards remaining | 322 |
| Device | 1375445b-203f-4f4b-8d09-780952c3722e |

### Alt 3: corncutoff (disposable)
| Field | Value |
|-------|-------|
| User ID | 2429 |
| Discord ID | (fresh — created 2026-03-17, 0 days before site join) |
| Site joined | 2026-03-17 |
| Linked player | NONE |
| Packs opened | 0 |
| W/L | 0/0 |
| Ember | 319 (unclaimed daily Ember only) |
| Cards | 0 |
| Device | **a486dc98-5a26-4edd-b31a-318d1edde287** (SAME as ziveno) |

### Alt 4: thetower0226 (disposable)
| Field | Value |
|-------|-------|
| User ID | 2430 |
| Discord ID | (fresh — created 2026-03-17, 0 days before site join) |
| Site joined | 2026-03-17 |
| Linked player | NONE |
| Packs opened | 0 |
| W/L | 0/0 |
| Ember | 319 (unclaimed daily Ember only) |
| Cards | 0 |
| Device | **a486dc98-5a26-4edd-b31a-318d1edde287** (SAME as ziveno) |

---

## 3. IP & Device Evidence

### Shared IPv6 Prefix
All accounts operate from the same /48 prefix: `2600:1702:5c60:78xx` — same household ISP assignment.

**13+ identical IPs** shared across attire7 ↔ ziveno ↔ vincetm, including:
- `2600:1702:5c60:7830:cc6:e63e:98b6:46f7`
- `2600:1702:5c60:7830:846d:3aaf:d1fb:44c3`
- `2600:1702:5c60:7830:438:cedd:b348:39b2`
- (and 10+ more)

### Device Fingerprint Smoking Gun
- **ziveno, corncutoff, and thetower0226 all share device `a486dc98`** — same browser, same profile, same operator
- attire7 uses 4 different device IDs — actively rotating browsers/profiles
- vincetm uses a separate device ID — likely a different browser/profile on the same machine

### Login Timing
All three main accounts started device tracking logins within minutes of each other on 2026-03-27:
- ziveno: 04:34:33 UTC
- attire7: 04:38:28 UTC
- vincetm: 04:51:23 UTC

### Previously Resolved Flags (Incorrect)
Two device flags exist that were marked RESOLVED (false positive):
- thetower0226 ↔ ziveno (device a486dc98) — flagged 2026-03-28
- corncutoff ↔ ziveno (device a486dc98) — flagged 2026-03-28

These should NOT have been resolved — they are genuine alt pairs.

---

## 4. Gift Evidence

### Gift Flow Summary
| From | To | Count | Type |
|------|----|-------|------|
| ziveno | attire7 | ~140 | osl-mixed, bsl-mixed packs |
| vincetm | attire7 | ~150 | osl-mixed, bsl-mixed packs |
| attire7 | ziveno | ~50 | returned gifts (keeping the loop alive) |
| attire7 | vincetm | ~50 | returned gifts |
| attire7/ziveno/vincetm | corncutoff | 1 each | free gifts (harvesting free-gift slots) |
| attire7/ziveno/vincetm | thetower0226 | 1 each | free gifts (harvesting free-gift slots) |

Total gift packs received by attire7 from alts: **~515**

### Ember Gift Loop
Both ziveno and vincetm run the classic Ember challenge → gift pack loop:
- **ziveno:** 67 challenge completions (3,325 Ember), 145 gift packs purchased (-1,450 Ember)
- **vincetm:** 66 challenge completions (3,195 Ember), 157 gift packs purchased (-1,570 Ember)
- Both also dismantle cards for Ember (ziveno: 2,902, vincetm: 2,271) to buy more packs and gift packs

---

## 5. Trade Evidence

### Exclusivity
| Account | Total trades | With attire7 | Exclusivity % |
|---------|-------------|-------------|---------------|
| vincetm | 87 | 85 | **97.7%** |
| ziveno | 113 | 110 | **97.3%** |
| attire7 | 280 | 195 (from these 2) | 69.6% |

All internal trades are 0-core swaps — pure card transfers, not real trades.

### Card Flow (Internal Trades)
| Account | Gave away |
|---------|-----------|
| ziveno | 225 epic, 27 legendary, 6 mythic, 11 common, 6 uncommon, 4 rare, 1 unique |
| vincetm | 207 epic, 28 legendary, 4 mythic, 2 common, 8 uncommon, 1 rare |
| attire7 | 271 epic, 27 legendary, 3 mythic, 2 common, 2 uncommon, 1 rare |

attire7 gives back roughly equal rarity counts — but this is to keep the alts' collections cycling through dismantles and new pack purchases. The NET flow of value is consistently toward attire7 through the gift pipeline.

---

## 6. Marketplace Operation

attire7 runs a marketplace flipping operation fueled by alt-farmed inventory:
- **Bought:** 50 cards for 4,395 Cores (buying cheap legendaries at 45-200 Cores)
- **Sold:** 14 cards for 5,697 Cores (selling at 199-1,500 Cores each)
- Notable sales: 2 mythics at 1,500 Cores each (Qin's Blade, Ullr)
- ziveno and vincetm sell cards to attire7 at **1 Core each** on the marketplace — another funneling channel

---

## 7. Not Part of the Cluster

**tastyytaco** was investigated and cleared:
- Different IP prefix (`2600:1014:a110:567b:*` — different network)
- Different device fingerprint (`fe2e6cf7`)
- Old Discord account (2017)
- Bidirectional gift exchange with attire7 (58 sent, 58 received — mutual, not one-way)
- Likely a legitimate trading partner

---

## 8. Severity Scoring

| Account | Signals | Score |
|---------|---------|-------|
| ziveno | Same IP (+40), no player link (+5), no battles (+5), 97.3% exclusive trader (+30), same device as corncutoff/thetower0226 (+40) | **120** |
| vincetm | Same IP (+40), no player link (+5), no battles (+5), 97.7% exclusive trader (+30), gifts overwhelmingly to attire7 (+30) | **110** |
| corncutoff | Fresh Discord 0-day (+40), same device as ziveno (+40), no player link (+5), no battles (+5), 0 packs/0 activity (+20) | **110** |
| thetower0226 | Fresh Discord 0-day (+40), same device as ziveno (+40), no player link (+5), no battles (+5), 0 packs/0 activity (+20) | **110** |

Combined cluster severity: **450** — one of the most systematic operations seen.

---

## 9. Timeline

| Date | Event |
|------|-------|
| 2026-03-13 | attire7 joins site |
| 2026-03-17 | ziveno, vincetm, corncutoff, thetower0226 all join site (same day) |
| 2026-03-17 | Massive gift dump begins: ziveno sends ~80+ packs to attire7 in one day |
| 2026-03-17 | vincetm sends ~80+ packs to attire7 in one day |
| 2026-03-17 | Free gift slots used: each target sends 1 free gift to corncutoff & thetower0226 |
| 2026-03-17–28 | Daily trading sessions: ziveno/vincetm trade cards to attire7 (0-core swaps) |
| 2026-03-18–29 | attire7 buys cheap legendaries on marketplace, resells at markup |
| 2026-03-27 | Device tracking starts — all 3 login within 17 minutes of each other |
| 2026-03-28 | Device flags auto-created for corncutoff/thetower0226 ↔ ziveno (incorrectly resolved) |
| 2026-03-28–29 | ziveno/vincetm start listing cards to attire7 on marketplace for 1 Core each |

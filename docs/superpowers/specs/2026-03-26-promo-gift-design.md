# Promo Gift System

## Summary

Owner-only feature to gift a specific, predetermined card to any user. The card arrives wrapped in a "Special Promo Gift Pack" that auto-pops up with the full PackOpening flip animation (single card reveal) when the recipient visits the Vault. Cards can optionally be trade-locked.

## Database

### New table: `cc_promo_gifts`

```sql
CREATE TABLE cc_promo_gifts (
  id SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  card_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  template_id INT REFERENCES cc_card_templates(id),
  card_config JSONB NOT NULL DEFAULT '{}',
  message TEXT,
  tradeable BOOLEAN NOT NULL DEFAULT true,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  card_id INT REFERENCES cc_cards(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_gifts_recipient ON cc_promo_gifts (recipient_id) WHERE claimed = false;
```

- `card_config` stores all card details: `{ god_id, god_name, god_class, role, image_url, card_data }`. Exact shape depends on card_type.
- `template_id` set for collection cards so template data can be fetched at claim time.
- `card_id` populated when claimed, linking to the created `cc_cards` row.

### New column on `cc_cards`

```sql
ALTER TABLE cc_cards ADD COLUMN trade_locked BOOLEAN NOT NULL DEFAULT false;
```

When a promo gift has `tradeable = false`, the claimed card gets `trade_locked = true`.

### Trade lock enforcement

Add `trade_locked` check to these existing validation paths:

1. **`functions/lib/trading.js` → `addCard()`** — reject if `card.trade_locked = true`
2. **`functions/lib/marketplace.js` → `createListing()`** — reject if `card.trade_locked = true`
3. **Frontend card actions** — hide/disable "List" and "Trade" buttons when `trade_locked` is true

## API

All actions go through `functions/api/vault.js`.

### `send-promo-gift` (POST, owner only)

**Input:**
```json
{
  "recipient_id": "123456",
  "card_type": "god",
  "rarity": "legendary",
  "template_id": null,
  "card_config": {
    "god_id": "smite-thor",
    "god_name": "Thor",
    "god_class": "Assassin",
    "role": "jungle",
    "image_url": "https://..."
  },
  "message": "Congrats on the tournament win!",
  "tradeable": true
}
```

**Validation:**
- Caller must be owner (hardcoded owner ID check, not RBAC)
- Recipient must exist in `users` table
- `card_type` must be valid (god/item/player/collection/staff/custom)
- `rarity` must be valid
- If `card_type = 'collection'`, `template_id` required and must reference an approved template

**Response:** `{ success: true, gift_id }`

### `claim-promo-gift` (POST, authenticated)

**Input:** `{ "gift_id": 1 }`

**Logic:**
1. Fetch gift row, verify `recipient_id = caller` and `claimed = false`
2. Create card in `cc_cards`:
   - All fields from `card_config` (god_id, god_name, god_class, role, image_url, card_data)
   - `card_type`, `rarity` from gift row
   - `holo_effect` = standard mapping from rarity (same as `rollHoloEffect`)
   - `holo_type` = standard mapping from rarity (same as `rollHoloType`)
   - `serial_number` = next serial for this card
   - `acquired_via = 'gift'`
   - `owner_id = recipient_id`, `original_owner_id = recipient_id`
   - `trade_locked = !gift.tradeable`
   - `template_id` from gift row (for collection cards)
   - `is_first_edition` = standard first-edition check
3. Update gift: `claimed = true`, `claimed_at = now()`, `card_id = new card id`
4. Return card object with template data inlined (for collection cards)

**Response:** `{ success: true, card: { ... } }`

### Vault load (`handleLoad`) addition

Add to existing load query:

```sql
SELECT id, card_type, rarity, card_config, message, template_id, tradeable, created_at
FROM cc_promo_gifts
WHERE recipient_id = $userId AND claimed = false
ORDER BY created_at ASC
```

Return as `promoGifts` array in load response.

## Frontend

### VaultContext changes

**New state:**
- `promoGifts` — array of unclaimed promo gifts from load response

**New action:**
- `claimPromoGift(giftId)` — POST to `claim-promo-gift`, on success:
  - Add returned card to `collection`
  - Merge template data into `templateCache` (if collection card)
  - Remove gift from `promoGifts` array

### Auto-popup flow (VaultPage / VaultInner)

After vault loads, if `promoGifts.length > 0`:

1. Show a styled modal: "Special Promo Gift Pack Available!" with the owner's optional message
2. "Open" button triggers `claimPromoGift(giftId)`
3. On success, render `<PackOpening>` with:
   - `result.packName = "Special Promo Gift Pack"`
   - `result.cards = [claimedCard]` (single card array)
   - Full flip animation, single card reveal
4. On PackOpening close, check `promoGifts` for next gift; repeat if more exist

Priority: promo gift popup shows before other Vault popups (Discord join, tradematch promo).

### Admin Dashboard section (owner only)

New section in AdminDashboard, visible only to owner. Form with:

1. **Recipient search** — user search/autocomplete (reuse existing user search patterns)
2. **Card type selector** — dropdown: god, item, player, collection, staff, custom
3. **Card configurator** (conditional on card_type):
   - **God**: god picker from SMITE data, role selector
   - **Item**: item picker from SMITE data
   - **Player**: player search from league_players
   - **Collection**: template picker from approved `cc_card_templates`
   - **Staff/Custom**: manual name + image URL fields
4. **Rarity picker** — common through unique
5. **Tradeable toggle** — checkbox, default on
6. **Message** — optional text field
7. **Send button** — calls `send-promo-gift`, shows confirmation

### Trade lock UI

Cards with `trade_locked = true`:
- Show a lock icon or "Promo — Not Tradeable" badge on the card
- Hide/disable "List on Market" and "Add to Trade" actions
- Visible in collection, binder, Starting Five — just can't be traded

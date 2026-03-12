# Pack Inventory Purchase — Design Spec

## Summary

Add a quantity selector to the regular pack shop that lets users buy multiple packs at once and add them to inventory instead of opening immediately. Single-pack purchases (qty=1) retain the current open-immediately behavior.

## Scope

- **In scope**: Regular pack shop only (CCPackShop.jsx `PackShop` component)
- **Out of scope**: Gift packs, limited sale packs (CCPackSale), mobile showcase

## UI Changes (CCPackShop.jsx)

### Quantity Counter

Add a quantity counter per focused pack in the info panel (right side of desktop shop, lines ~681-748):

- **Default**: qty = 1
- **Controls**: decrement (−) and increment (+) buttons flanking the count
- **Decrement disabled at 1**, no upper cap
- **Resets to 1** when the user focuses a different pack type

### Button Behavior

- **qty = 1**: Current button — "Open for {cost}" — calls `buyPack()`, triggers PackOpening animation
- **qty > 1**: Button changes to "Add to Inventory for {cost × qty} ({cost} per Pack)" — calls new `buyPacksToInventory()`, no animation, shows success feedback (e.g. brief toast or inline confirmation), refreshes inventory count

### Insufficient Balance

- If `ember < cost * qty`, the button is disabled (existing behavior already disables at insufficient balance — extend to use `cost * qty`)
- The "Get Cores" hint already shows when balance is low — no changes needed

## Backend Changes (functions/api/vault.js)

### New Action: `buy-packs-to-inventory`

POST handler at `action=buy-packs-to-inventory`:

```
Body: { packType: number, quantity: number }
```

Logic:
1. `requireAuth(event)` — must be logged in
2. Validate `quantity` is a positive integer, cap at 100 server-side as a sanity guard
3. Look up pack from `cc_pack_types` — must be `enabled = true`, not a sale pack
4. Check Ember balance >= `pack.cost * quantity`
5. Deduct `pack.cost * quantity` Ember via `grantEmber(sql, userId, 'cc_pack', -(cost * quantity))`
6. Insert `quantity` rows into `cc_pack_inventory` with `source = 'shop'`
7. Return updated stats (ember balance) + new inventory items

No changes to `functions/lib/vault.js` — card generation is not involved.

## Frontend Service Layer (src/services/database.js)

Add to `vaultService`:

```js
async buyPacksToInventory(packType, quantity) {
  return apiPost('vault', { action: 'buy-packs-to-inventory' }, { packType, quantity })
}
```

## VaultContext Changes

Add new method:

```js
async function buyPacksToInventory(packType, quantity) {
  const res = await vaultService.buyPacksToInventory(packType, quantity)
  // Update inventory state with new items
  // Refresh ember balance
  // No pack opening animation
}
```

Expose via context value alongside existing `buyPack`.

## Data Flow

```
User sets qty > 1, clicks "Add to Inventory"
  → VaultContext.buyPacksToInventory(packType, qty)
    → vaultService.buyPacksToInventory(packType, qty)
      → POST /api/vault?action=buy-packs-to-inventory { packType, quantity }
        → Validate pack + balance
        → Deduct Ember
        → INSERT INTO cc_pack_inventory (qty rows)
        → Return { ember, inventory }
    → Update VaultContext state (inventory, stats)
  → UI shows success, qty resets to 1
```

## No Migration Required

`cc_pack_inventory` already has the right schema: `(id, user_id, pack_type_id, source, created_at)`. Source `'shop'` is already an implied value. No new columns or tables needed.

## Edge Cases

- **Rapid clicks**: Disable button while request is in flight (existing `loading` state pattern)
- **Balance changes between render and click**: Server validates balance — returns error if insufficient
- **Pack disabled between render and click**: Server validates `enabled = true` — returns error

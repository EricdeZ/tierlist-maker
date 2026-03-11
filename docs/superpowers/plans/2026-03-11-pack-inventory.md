# Pack Inventory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pack inventory system so users can hold packs (starter packs, gifted packs) and open them later from a new "My Packs" tab on the packs page.

**Architecture:** New `cc_pack_inventory` table stores unopened packs. The `handleLoad` API returns inventory alongside existing data. Starter packs (2 OSL + 2 BSL) are granted on first visit via `ensureStats`. A new `open-inventory-pack` POST action deletes the row and generates cards via `openPack(skipPayment)`. The pack page toggle adds "MY PACKS" as the first option, showing inventory packs + unopened gifts.

**Tech Stack:** PostgreSQL migration, Cloudflare Pages Function (existing `functions/api/cardclash.js`), React frontend (existing `CCPackShop.jsx`).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `database/migrations/088-pack-inventory.sql` | Create | New table + seed starter packs for existing users |
| `functions/lib/cardclash.js` | Modify | Add `grantStarterPacks()` helper, call from `ensureStats` |
| `functions/api/cardclash.js` | Modify | Return inventory in `handleLoad`, add `open-inventory-pack` action |
| `src/services/database.js` | Modify | Add `openInventoryPack()` to `cardclashService` |
| `src/pages/cardclash/CardClashContext.jsx` | Modify | Add `inventory` state, `openInventoryPack` action |
| `src/pages/cardclash/CCPackShop.jsx` | Modify | Add "MY PACKS" toggle + inventory view |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/088-pack-inventory.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Pack inventory: users can hold packs and open them later.
-- Starter packs (2 OSL + 2 BSL) are granted to all users.

CREATE TABLE IF NOT EXISTS cc_pack_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_type_id TEXT NOT NULL REFERENCES cc_pack_types(id),
    source TEXT NOT NULL DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_pack_inventory_user ON cc_pack_inventory(user_id);

-- Grant 2 OSL + 2 BSL starter packs to all existing users with cc_stats
INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
SELECT user_id, pack_type, 'starter'
FROM cc_stats
CROSS JOIN (
    VALUES ('osl-mixed'), ('osl-mixed'), ('bsl-mixed'), ('bsl-mixed')
) AS packs(pack_type);
```

- [ ] **Step 2: Run migration against dev database**

Run: `psql $DATABASE_URL -f database/migrations/088-pack-inventory.sql`
Expected: CREATE TABLE, CREATE INDEX, INSERT rows

- [ ] **Step 3: Commit**

```bash
git add database/migrations/088-pack-inventory.sql
git commit -m "feat: add cc_pack_inventory table with starter packs migration"
```

---

### Task 2: Backend — Starter Pack Grant + Inventory Query

**Files:**
- Modify: `functions/lib/cardclash.js` (add `grantStarterPacks`, export it)
- Modify: `functions/api/cardclash.js` (return inventory in `handleLoad`, add `open-inventory-pack` action)

- [ ] **Step 1: Add `grantStarterPacks` to `functions/lib/cardclash.js`**

After the existing `ensureStats` function (~line 314), add:

```js
export async function grantStarterPacks(sql, userId) {
  const [existing] = await sql`
    SELECT 1 FROM cc_pack_inventory WHERE user_id = ${userId} AND source = 'starter' LIMIT 1
  `
  if (existing) return
  const packs = ['osl-mixed', 'osl-mixed', 'bsl-mixed', 'bsl-mixed']
  for (const packType of packs) {
    await sql`
      INSERT INTO cc_pack_inventory (user_id, pack_type_id, source)
      VALUES (${userId}, ${packType}, 'starter')
    `
  }
}
```

- [ ] **Step 2: Add inventory query + starter grant to `handleLoad` in `functions/api/cardclash.js`**

In `handleLoad` (~line 73), after `ensureStats(sql, user.id)` and `ensureEmberBalance(sql, user.id)`, add:

```js
await grantStarterPacks(sql, user.id)
```

Update the import at the top (~line 8) to include `grantStarterPacks`:
```js
import { ensureStats, openPack, generateGiftPack, grantStarterPacks } from '../lib/cardclash.js'
```

Add `inventory` to the `Promise.all` array (~line 84):
```js
sql`SELECT i.id, i.pack_type_id, i.source, i.created_at, pt.name
    FROM cc_pack_inventory i
    JOIN cc_pack_types pt ON i.pack_type_id = pt.id
    WHERE i.user_id = ${user.id}
    ORDER BY i.created_at`,
```

Destructure it (add after `tradeCount`):
```js
const [collection, stats, ember, packTypes, salePacks, tradeCount, inventory] = await Promise.all([...])
```

Add `inventory` to the response body JSON (after `pendingTradeCount`):
```js
inventory: inventory.map(i => ({
  id: i.id,
  packTypeId: i.pack_type_id,
  packName: i.name,
  source: i.source,
  createdAt: i.created_at,
})),
```

- [ ] **Step 3: Add `open-inventory-pack` POST action in `functions/api/cardclash.js`**

Add to the POST switch (~line 61):
```js
case 'open-inventory-pack': return await handleOpenInventoryPack(sql, user, body)
```

Add the handler function (after `handleOpenPack`, ~line 170):

```js
// ═══ POST: Open a pack from inventory ═══
async function handleOpenInventoryPack(sql, user, body) {
  const { inventoryId } = body
  if (!inventoryId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'inventoryId required' }) }

  const [item] = await sql`
    DELETE FROM cc_pack_inventory
    WHERE id = ${inventoryId} AND user_id = ${user.id}
    RETURNING pack_type_id
  `
  if (!item) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pack not found in inventory' }) }

  const result = await openPack(sql, user.id, item.pack_type_id, { skipPayment: true })
  const cards = result.cards.map((c) => {
    const formatted = formatCard(c)
    if (c._revealOrder != null) formatted._revealOrder = c._revealOrder
    return formatted
  })

  // Push vault challenge progress (fire-and-forget)
  getVaultStats(sql, user.id)
    .then(stats => pushChallengeProgress(sql, user.id, stats))
    .catch(err => console.error('Vault challenge push failed:', err))

  return { statusCode: 200, headers, body: JSON.stringify({
    packName: result.packName,
    packType: item.pack_type_id,
    cards,
  }) }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/cardclash.js functions/api/cardclash.js
git commit -m "feat: pack inventory backend — starter packs, load inventory, open from inventory"
```

---

### Task 3: Frontend Service + Context

**Files:**
- Modify: `src/services/database.js` (~line 1039, add method)
- Modify: `src/pages/cardclash/CardClashContext.jsx`

- [ ] **Step 1: Add `openInventoryPack` to `cardclashService` in `src/services/database.js`**

After the `collectIncome` method (~line 1038), add:

```js
    openInventoryPack(inventoryId) {
        return apiPost('cardclash', { action: 'open-inventory-pack' }, { inventoryId })
    },
```

- [ ] **Step 2: Add inventory state and action to `CardClashContext.jsx`**

Add `inventory` state (~line 17, after `pendingTradeCount`):
```js
const [inventory, setInventory] = useState([])
```

In the `load` effect (~line 28), add after `setPendingTradeCount`:
```js
setInventory(ccData.inventory || [])
```

Add `openInventoryPack` callback (after `buyPack`, ~line 155):
```js
const openInventoryPack = useCallback(async (inventoryId) => {
  try {
    const result = await cardclashService.openInventoryPack(inventoryId)
    setCollection(prev => [...prev, ...result.cards])
    setStats(prev => ({ ...prev, packsOpened: prev.packsOpened + 1 }))
    setInventory(prev => prev.filter(i => i.id !== inventoryId))
    passionCtx?.refreshBalance?.()
    return result
  } catch (err) {
    console.error('Failed to open inventory pack:', err)
    throw err
  }
}, [passionCtx])
```

Add `inventory` and `openInventoryPack` to the Provider value (~line 177):
```jsx
inventory, openInventoryPack,
```

- [ ] **Step 3: Commit**

```bash
git add src/services/database.js src/pages/cardclash/CardClashContext.jsx
git commit -m "feat: pack inventory frontend service + context state"
```

---

### Task 4: Pack Page UI — "My Packs" Toggle + Inventory View

**Files:**
- Modify: `src/pages/cardclash/CCPackShop.jsx`

- [ ] **Step 1: Update `PackShopRouter` to add "MY PACKS" toggle**

Replace the `PackShopRouter` component (~line 177-214) with a 3-way toggle:

```jsx
export default function PackShopRouter() {
  const { inventory, giftData } = useCardClash();
  const [mode, setMode] = useState('shop');

  // Count of openable packs: inventory items + unopened gifts
  const unopenedGifts = (giftData?.received || []).filter(g => !g.opened).length;
  const myPacksCount = (inventory?.length || 0) + unopenedGifts;

  return (
    <>
      <div className="flex justify-center gap-1.5 sm:gap-2 -mt-2 sm:mt-0 mb-2 sm:mb-4 relative z-40">
        <button
          onClick={() => setMode('my-packs')}
          className={`relative px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'my-packs'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          MY PACKS
          {myPacksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-black flex items-center justify-center">
              {myPacksCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMode('shop')}
          className={`px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'shop'
              ? 'bg-white/10 text-white border-white/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          SHOP
        </button>
        <button
          onClick={() => setMode('sale')}
          className={`px-4 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-widest border rounded transition-all cursor-pointer ${
            mode === 'sale'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-transparent text-white/30 border-white/10 hover:text-white/50'
          }`}
          style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, letterSpacing: '0.2em' }}
        >
          LIMITED SALE
        </button>
      </div>
      {mode === 'my-packs' ? (
        <MyPacks />
      ) : mode === 'shop' ? (
        <PackShop />
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="cd-spinner w-8 h-8" /></div>}>
          <CCPackSale />
        </Suspense>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add `MyPacks` component**

Add the `MyPacks` component in `CCPackShop.jsx` (before the `PackShop` function). This component shows inventory packs and unopened gifts, with click-to-open functionality:

```jsx
function MyPacks() {
  const { inventory, openInventoryPack, giftData, openGift } = useCardClash();
  const [openResult, setOpenResult] = useState(null);
  const [loading, setLoading] = useState(null); // inventoryId or giftId being opened

  const unopenedGifts = (giftData?.received || []).filter(g => !g.opened);
  const hasAny = (inventory?.length || 0) + unopenedGifts.length > 0;

  const handleOpenInventory = useCallback(async (item) => {
    try {
      setLoading(`inv-${item.id}`);
      const result = await openInventoryPack(item.id);
      if (!result) { setLoading(null); return; }
      setOpenResult({ ...result, packType: item.packTypeId });
      setLoading(null);
    } catch (err) {
      setLoading(null);
      alert(err.message || 'Failed to open pack');
    }
  }, [openInventoryPack]);

  const handleOpenGift = useCallback(async (gift) => {
    try {
      setLoading(`gift-${gift.id}`);
      const result = await openGift(gift.id);
      if (!result) { setLoading(null); return; }
      setOpenResult(result);
      setLoading(null);
    } catch (err) {
      setLoading(null);
      alert(err.message || 'Failed to open gift');
    }
  }, [openGift]);

  if (!hasAny) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 text-white/15 mx-auto mb-3" />
        <p className="text-white/30 cd-head tracking-wider text-sm">No packs in your inventory</p>
        <p className="text-white/20 text-xs mt-1">Buy packs from the Shop or receive gifts from friends</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inventory Packs */}
      {inventory.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">
            Starter Packs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {inventory.map((item, i) => {
              const pack = PACKS[item.packTypeId];
              if (!pack) return null;
              const meta = PACK_META[item.packTypeId];
              const isOpening = loading === `inv-${item.id}`;
              return (
                <button
                  key={item.id}
                  onClick={() => handleOpenInventory(item)}
                  disabled={!!loading}
                  className="cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-all disabled:opacity-50 group"
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="relative group-hover:scale-105 transition-transform">
                    <PackArt
                      tier={item.packTypeId}
                      name={pack.name}
                      subtitle={meta?.subtitle || ''}
                      cardCount={pack.cards}
                      seed={meta?.seed || 5}
                      compact
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold cd-head tracking-wider" style={{ color: pack.color || 'var(--cd-cyan)' }}>
                      {pack.name}
                    </div>
                    <div className="text-[10px] text-white/30">{pack.cards} cards</div>
                  </div>
                  {isOpening ? (
                    <div className="cd-spinner w-4 h-4" />
                  ) : (
                    <span className="text-[10px] text-emerald-400/70 cd-head tracking-wider font-bold group-hover:text-emerald-400 transition-colors">
                      TAP TO OPEN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unopened Gifts */}
      {unopenedGifts.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">
            Gift Packs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {unopenedGifts.map((gift, i) => {
              const packType = gift.packType || 'gift';
              const pack = PACKS[packType];
              const isOpening = loading === `gift-${gift.id}`;
              return (
                <button
                  key={gift.id}
                  onClick={() => handleOpenGift(gift)}
                  disabled={!!loading}
                  className="cd-panel cd-corners rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-all disabled:opacity-50 group"
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="relative group-hover:scale-105 transition-transform">
                    <PackArt
                      tier={packType}
                      name={pack?.name || 'Gift Pack'}
                      subtitle="Gift"
                      cardCount={pack?.cards || 5}
                      seed={i + 10}
                      compact
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold cd-head tracking-wider text-red-400">
                      From {gift.senderName}
                    </div>
                    {gift.message && (
                      <div className="text-[10px] text-white/30 truncate max-w-[120px] italic">"{gift.message}"</div>
                    )}
                  </div>
                  {isOpening ? (
                    <div className="cd-spinner w-4 h-4" />
                  ) : (
                    <span className="text-[10px] text-emerald-400/70 cd-head tracking-wider font-bold group-hover:text-emerald-400 transition-colors">
                      TAP TO OPEN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pack opening ceremony */}
      {openResult && (
        <PackOpening
          result={openResult}
          packType={openResult.packType}
          onClose={() => setOpenResult(null)}
          onOpenMore={() => setOpenResult(null)}
        />
      )}
    </div>
  );
}
```

Note: Add `Package` to the lucide-react imports that are already used in the file. Currently only `PackArt`, `PackOpening`, etc. are imported. `Package` is imported from lucide-react in `CCGifts.jsx` but not in `CCPackShop.jsx`. Add it:

At the top of `CCPackShop.jsx`, add `Package` from lucide-react:
```js
import { Package } from 'lucide-react'
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/cardclash/CCPackShop.jsx
git commit -m "feat: My Packs tab with inventory + gift packs display"
```

---

### Task 5: Verify and Test

- [ ] **Step 1: Start dev server and verify**

Run: `npm start`
- Visit the Vault packs page
- Confirm three toggles appear: MY PACKS | SHOP | LIMITED SALE
- Confirm "My Packs" shows starter packs (after migration is run)
- Confirm clicking a pack triggers the pack opening ceremony
- Confirm opened packs disappear from inventory
- Confirm gifts still appear in "My Packs" section
- Confirm shop packs still open immediately

- [ ] **Step 2: Final commit if any fixes needed**

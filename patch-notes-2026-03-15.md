# Patch Notes — March 15, 2026

**Starting Five**
- Fixed consumable equip being blocked by old completed trades
- Attachment slots can now be clicked to swap directly
- Fixed unnecessary re-renders when Passion balance updates

**Trading**
- Fixed invite polling not clearing when a trade was found
- Fixed trade timeout sometimes cancelling the wrong trade
- Fixed trade completion triggering extra re-renders

**Collection & Marketplace**
- Cards with the same name now sort by team and rarity too
- Card zoom modal now shows duplicate count badges (x2, x3)
- Rarity buttons in zoom modal now wrap properly on mobile
- Marketplace "create listing" view now has rarity, type, holo, and role filters

**Performance**
- Vault context no longer causes all pages to re-render on every state change
- Passion/Cores balance updates no longer trigger render loops

**Binder Sharing**
- Shared binders now work on mobile with single-page swipe navigation

**Admin**
- Feedback manager now supports multi-select and bulk delete

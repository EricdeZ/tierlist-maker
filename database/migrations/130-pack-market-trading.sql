-- ═══ Pack Market & Trading Support ═══
-- Extend marketplace and trading tables to support packs alongside cards

-- ═══ cc_market_listings: add pack support ═══

ALTER TABLE cc_market_listings ALTER COLUMN card_id DROP NOT NULL;
-- NOTE: The existing idx_cc_market_card_active UNIQUE(card_id) WHERE status='active'
-- allows multiple NULL card_id rows (PostgreSQL NULL uniqueness semantics).
-- This is safe because the CHECK constraint below ensures card_id IS NOT NULL
-- when item_type='card'. Pack uniqueness is enforced by idx_cc_market_pack_active.

ALTER TABLE cc_market_listings
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);
-- NOTE: No ON DELETE CASCADE on pack_inventory_id — intentional.
-- Pack opening must check for active listings before deleting the inventory row.
-- The FK prevents orphaned references if the app-layer check is bypassed.

ALTER TABLE cc_market_listings ADD CONSTRAINT market_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

CREATE UNIQUE INDEX idx_cc_market_pack_active
  ON cc_market_listings (pack_inventory_id)
  WHERE status = 'active';

-- ═══ cc_trade_cards: add pack support ═══

ALTER TABLE cc_trade_cards ALTER COLUMN card_id DROP NOT NULL;
-- NOTE: The existing UNIQUE(trade_id, card_id) allows multiple NULL card_id rows.
-- Safe because CHECK constraint ensures card_id IS NOT NULL when item_type='card'.
-- Pack uniqueness enforced by idx_cc_trade_packs_unique below.

ALTER TABLE cc_trade_cards
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN pack_inventory_id INTEGER REFERENCES cc_pack_inventory(id);
-- NOTE: No ON DELETE CASCADE — same reasoning as marketplace.

ALTER TABLE cc_trade_cards ADD CONSTRAINT trade_item_check CHECK (
  (item_type = 'card' AND card_id IS NOT NULL AND pack_inventory_id IS NULL)
  OR
  (item_type = 'pack' AND pack_inventory_id IS NOT NULL AND card_id IS NULL)
);

CREATE UNIQUE INDEX idx_cc_trade_packs_unique
  ON cc_trade_cards (trade_id, pack_inventory_id)
  WHERE pack_inventory_id IS NOT NULL;

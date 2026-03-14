-- Add original_owner_id to track who originally pulled/received each card
ALTER TABLE cc_cards ADD COLUMN original_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Backfill: default all cards to current owner
UPDATE cc_cards SET original_owner_id = owner_id;

-- Fix cards that changed hands (marketplace sales or trades) — set to earliest transferor
WITH first_transfer AS (
  SELECT card_id, seller_id AS from_user, sold_at AS transferred_at
  FROM cc_market_listings WHERE status = 'sold'
  UNION ALL
  SELECT tc.card_id, tc.offered_by AS from_user, t.completed_at AS transferred_at
  FROM cc_trade_cards tc
  JOIN cc_trades t ON t.id = tc.trade_id
  WHERE t.status = 'completed'
),
earliest AS (
  SELECT DISTINCT ON (card_id) card_id, from_user
  FROM first_transfer
  ORDER BY card_id, transferred_at ASC
)
UPDATE cc_cards c
SET original_owner_id = e.from_user
FROM earliest e
WHERE c.id = e.card_id;

-- Index for querying cards by original puller
CREATE INDEX idx_cc_cards_original_owner ON cc_cards(original_owner_id);

-- Return existing slotted consumables to inventory
UPDATE cc_starting_five_state SET consumable_card_id = NULL
WHERE consumable_card_id IS NOT NULL;

-- Remove all active consumable listings from marketplace
UPDATE cc_market_listings SET status = 'cancelled'
WHERE status = 'active'
  AND card_id IN (SELECT id FROM cc_cards WHERE card_type = 'consumable');

-- Drop old system
DROP INDEX IF EXISTS cc_s5_consumable_uniq;
ALTER TABLE cc_starting_five_state DROP COLUMN IF EXISTS consumable_card_id;

-- Add new consumable system columns
ALTER TABLE cc_starting_five_state
  ADD COLUMN IF NOT EXISTS active_buffs JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS consumable_slots_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismantle_boost_mult NUMERIC(6,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS dismantle_boost_date DATE;

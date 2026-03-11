-- Add god and item attachment columns to cc_lineups
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS god_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS item_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

-- Prevent same card from being attached in multiple slots
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_god_uniq ON cc_lineups(god_card_id) WHERE god_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cc_lineups_item_uniq ON cc_lineups(item_card_id) WHERE item_card_id IS NOT NULL;

-- Add lineup_type column ('current' or 'allstar') to cc_lineups
-- Default existing rows to 'current' (Current Season)
ALTER TABLE cc_lineups ADD COLUMN lineup_type TEXT NOT NULL DEFAULT 'current';

-- Drop old PK and create new one including lineup_type
ALTER TABLE cc_lineups DROP CONSTRAINT cc_lineups_pkey;
ALTER TABLE cc_lineups ADD PRIMARY KEY (user_id, lineup_type, role);

-- Drop existing inline role CHECK constraint (created in 070-card-clash.sql)
-- The auto-generated name may vary; query pg_constraint if this fails
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_role_check;
-- Also try the common auto-generated name pattern
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_check;

-- Add check constraints for the expanded schema
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_lineup_type_check
  CHECK (lineup_type IN ('current', 'allstar'));
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_role_check
  CHECK (role IN ('solo', 'jungle', 'mid', 'support', 'adc', 'bench'));

-- Existing unique indexes on god_card_id and item_card_id (from 095 migration)
-- already enforce global uniqueness across all lineups — keep them as-is

-- Add unique constraint: a card_id can only appear in one lineup across both types
-- (prevents same player card in both lineups)
CREATE UNIQUE INDEX cc_lineups_card_exclusivity ON cc_lineups (card_id) WHERE card_id IS NOT NULL;

-- Staff slot placeholder (TBD design, just add the column)
ALTER TABLE cc_starting_five_state ADD COLUMN staff_card_id INTEGER REFERENCES cc_cards(id) ON DELETE SET NULL;

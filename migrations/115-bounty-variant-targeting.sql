-- Migration 115: Bounty variant targeting
-- Bounties now target specific card variants (god role, player team/season)
-- and require explicit holo type selection

-- Add target_god_id to store the specific card variant identifier
ALTER TABLE cc_bounties ADD COLUMN target_god_id TEXT;

-- Migrate holo_type: NULL (any) → 'any_holo', add 'none' for non-holo
UPDATE cc_bounties SET holo_type = 'any_holo' WHERE holo_type IS NULL;
ALTER TABLE cc_bounties ALTER COLUMN holo_type SET NOT NULL;
ALTER TABLE cc_bounties ALTER COLUMN holo_type SET DEFAULT 'none';

-- Backfill target_god_id for existing bounties where possible
-- God bounties: match by card_name to god slug (best effort — base god only)
-- Player bounties: can't reliably backfill without knowing which variant was intended
-- Item/consumable: match by card_name to slug

-- Drop old fulfillment index and create new one using target_god_id
DROP INDEX IF EXISTS idx_bounties_card_spec;
CREATE INDEX idx_bounties_card_spec ON cc_bounties (card_type, target_god_id, rarity) WHERE status = 'active';

-- Update card-side index for bounty fulfillment matching
DROP INDEX IF EXISTS idx_cc_cards_bounty_match;
CREATE INDEX idx_cc_cards_bounty_match ON cc_cards (owner_id, card_type, god_id, rarity, holo_type);

-- Add holo_type to cc_cards (holo/reverse/full for uncommon+, NULL for common)
ALTER TABLE cc_cards ADD COLUMN IF NOT EXISTS holo_type TEXT;

-- Backfill existing uncommon+ cards with random holo type
UPDATE cc_cards
SET holo_type = (ARRAY['holo','reverse','full'])[floor(random()*3)+1]
WHERE rarity != 'common' AND holo_type IS NULL;

-- Add slotted_at to existing cc_lineups table
ALTER TABLE cc_lineups ADD COLUMN IF NOT EXISTS slotted_at TIMESTAMPTZ DEFAULT NOW();

-- Per-user Starting 5 income state
CREATE TABLE IF NOT EXISTS cc_starting_five_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    passion_pending NUMERIC(10,4) DEFAULT 0,
    cores_pending NUMERIC(10,4) DEFAULT 0,
    last_tick TIMESTAMPTZ
);

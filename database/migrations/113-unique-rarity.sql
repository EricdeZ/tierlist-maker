-- Unique rarity: only one unique card per player def can exist globally
-- Partial unique index prevents duplicates even under race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_cards_unique_per_def
  ON cc_cards (def_id) WHERE rarity = 'unique';

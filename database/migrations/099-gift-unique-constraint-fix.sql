-- Migration 099: Fix gift unique constraint to allow multiple gift types per recipient
-- The original UNIQUE(sender_id, recipient_id) blocks purchased gifts to users
-- who already received a free gift. Scope the uniqueness to free gifts only.

ALTER TABLE cc_gifts DROP CONSTRAINT IF EXISTS cc_gifts_unique_pair;

CREATE UNIQUE INDEX IF NOT EXISTS cc_gifts_unique_free_pair
  ON cc_gifts (sender_id, recipient_id) WHERE pack_type = 'gift';

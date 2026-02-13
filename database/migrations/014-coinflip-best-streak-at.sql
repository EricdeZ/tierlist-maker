-- Migration 014: Track when best streak was achieved for tiebreaking
ALTER TABLE coinflip_streaks
    ADD COLUMN IF NOT EXISTS best_streak_at TIMESTAMPTZ;

-- Backfill existing rows: use updated_at as best approximation
UPDATE coinflip_streaks SET best_streak_at = updated_at WHERE best_streak > 0 AND best_streak_at IS NULL;

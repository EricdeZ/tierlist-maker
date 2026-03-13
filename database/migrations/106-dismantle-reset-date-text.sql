-- Fix timezone mismatch: DATE type gets timezone-shifted by Neon driver, breaking daily reset comparison
ALTER TABLE cc_stats ALTER COLUMN dismantle_reset_date TYPE TEXT USING dismantle_reset_date::TEXT;

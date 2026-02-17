-- Migration 021: match_manage_own — ownership-based match editing
-- Adds reported_by column to track who submitted each match.
-- Existing matches keep NULL (only match_manage holders can edit those).

ALTER TABLE matches ADD COLUMN IF NOT EXISTS reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_reported_by ON matches(reported_by);

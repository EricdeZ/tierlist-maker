-- Migration 008: Link scheduled matches to reported matches
-- Adds match_id column to scheduled_matches for cross-referencing.

ALTER TABLE scheduled_matches
    ADD COLUMN IF NOT EXISTS match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL;

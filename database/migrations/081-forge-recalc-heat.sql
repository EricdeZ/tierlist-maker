-- Migration 081: Add price_snapshots to player_sparks
-- Stores a JSONB array of {gc, price} entries — one per recalc boundary.
-- Each entry records the game count and current_price at the time new games were detected,
-- so the expectation formula can use the correct price for each phase of the replay.
ALTER TABLE player_sparks ADD COLUMN IF NOT EXISTS recalc_heat numeric(10,2);
ALTER TABLE player_sparks ADD COLUMN IF NOT EXISTS price_snapshots jsonb DEFAULT '[]';

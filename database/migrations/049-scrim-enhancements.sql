-- Migration 049: Scrim Enhancements
-- Adds division filter, region filter, and confirmation flow to scrim_requests.

-- ═══════════════════════════════════════════════════
-- Part A: Division Filter (alternative to tier filter)
-- ═══════════════════════════════════════════════════

-- JSONB array of division IDs (e.g., [3, 7, 12])
-- Mutually exclusive with acceptable_tiers: one is NULL when the other is set.
ALTER TABLE scrim_requests ADD COLUMN acceptable_divisions JSONB;

-- ═══════════════════════════════════════════════════
-- Part B: Region Filter
-- ═══════════════════════════════════════════════════

ALTER TABLE scrim_requests ADD COLUMN region VARCHAR(10) NOT NULL DEFAULT 'NA';
ALTER TABLE scrim_requests ADD CONSTRAINT chk_scrim_region
    CHECK (region IN ('NA', 'EU'));

-- ═══════════════════════════════════════════════════
-- Part C: Confirmation Flow
-- ═══════════════════════════════════════════════════

ALTER TABLE scrim_requests ADD COLUMN requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE;

-- Pending acceptance info (populated when someone accepts a requires_confirmation scrim)
ALTER TABLE scrim_requests ADD COLUMN pending_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE scrim_requests ADD COLUMN pending_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE scrim_requests ADD COLUMN pending_at TIMESTAMPTZ;

-- Discord DM tracking for reply-based confirmation
ALTER TABLE scrim_requests ADD COLUMN dm_channel_id VARCHAR(30);
ALTER TABLE scrim_requests ADD COLUMN confirmation_dm_id VARCHAR(30);

-- Expand status constraint to include 'pending_confirmation'
ALTER TABLE scrim_requests DROP CONSTRAINT IF EXISTS chk_scrim_status;
ALTER TABLE scrim_requests ADD CONSTRAINT chk_scrim_status
    CHECK (status IN ('open', 'accepted', 'cancelled', 'expired', 'completed', 'no_show', 'disputed', 'pending_confirmation'));

-- Index for polling pending confirmations
CREATE INDEX idx_scrim_requests_pending ON scrim_requests(status)
    WHERE status = 'pending_confirmation';

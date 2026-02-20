-- Migration 037: Scrim Outcome Reporting + Blacklist
-- Adds outcome tracking to scrim_requests and a per-team blacklist table.

-- ═══════════════════════════════════════════════════
-- Part A: Outcome Reporting
-- ═══════════════════════════════════════════════════

-- Expand status constraint with new values
ALTER TABLE scrim_requests DROP CONSTRAINT chk_scrim_status;
ALTER TABLE scrim_requests ADD CONSTRAINT chk_scrim_status
    CHECK (status IN ('open', 'accepted', 'cancelled', 'expired', 'completed', 'no_show', 'disputed'));

-- Outcome tracking columns
ALTER TABLE scrim_requests ADD COLUMN outcome VARCHAR(30);
ALTER TABLE scrim_requests ADD COLUMN outcome_reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE scrim_requests ADD COLUMN outcome_reported_at TIMESTAMPTZ;
ALTER TABLE scrim_requests ADD COLUMN outcome_disputed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE scrim_requests ADD COLUMN outcome_dispute_deadline TIMESTAMPTZ;

ALTER TABLE scrim_requests ADD CONSTRAINT chk_scrim_outcome
    CHECK (outcome IS NULL OR outcome IN ('completed', 'no_show_by_poster', 'no_show_by_accepter'));

-- ═══════════════════════════════════════════════════
-- Part B: Scrim Blacklist
-- ═══════════════════════════════════════════════════

CREATE TABLE scrim_blacklist (
    id              SERIAL PRIMARY KEY,
    team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    blocked_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scrim_blacklist UNIQUE (team_id, blocked_team_id),
    CONSTRAINT chk_no_self_block CHECK (team_id != blocked_team_id)
);

CREATE INDEX idx_scrim_blacklist_team ON scrim_blacklist(team_id);
CREATE INDEX idx_scrim_blacklist_blocked ON scrim_blacklist(blocked_team_id);

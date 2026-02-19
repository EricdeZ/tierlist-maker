-- Migration 034: Scrim Planner
-- Adds scrim_requests table for GameBattles-style scrim scheduling.
-- Captains can post open requests or directly challenge specific teams.

CREATE TABLE scrim_requests (
    id                    SERIAL PRIMARY KEY,
    team_id               INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    challenged_team_id    INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    scheduled_date        TIMESTAMPTZ NOT NULL,
    pick_mode             VARCHAR(30) NOT NULL DEFAULT 'regular',
    banned_content_league VARCHAR(255),
    notes                 TEXT,
    status                VARCHAR(20) NOT NULL DEFAULT 'open',
    accepted_team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    accepted_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scrim_requests_status ON scrim_requests(status);
CREATE INDEX idx_scrim_requests_team ON scrim_requests(team_id);
CREATE INDEX idx_scrim_requests_challenged ON scrim_requests(challenged_team_id) WHERE challenged_team_id IS NOT NULL;
CREATE INDEX idx_scrim_requests_date ON scrim_requests(scheduled_date);

ALTER TABLE scrim_requests ADD CONSTRAINT chk_scrim_status
    CHECK (status IN ('open', 'accepted', 'cancelled', 'expired'));
ALTER TABLE scrim_requests ADD CONSTRAINT chk_pick_mode
    CHECK (pick_mode IN ('regular', 'fearless', 'fearless_picks', 'fearless_bans'));

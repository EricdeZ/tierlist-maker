-- Migration 069: Scrim confirmation request queue
-- Replaces single pending_team_id with a queue so multiple teams can request
-- confirmation at the same time, and the scrim stays open until confirmed.

CREATE TABLE scrim_confirmation_requests (
    id              SERIAL PRIMARY KEY,
    scrim_id        INTEGER NOT NULL REFERENCES scrim_requests(id) ON DELETE CASCADE,
    team_id         INTEGER NOT NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    CONSTRAINT chk_conf_status CHECK (status IN ('pending', 'confirmed', 'denied', 'withdrawn'))
);

-- One pending request per team per scrim
CREATE UNIQUE INDEX idx_scrim_conf_unique_pending
    ON scrim_confirmation_requests(scrim_id, team_id) WHERE status = 'pending';

CREATE INDEX idx_scrim_conf_scrim ON scrim_confirmation_requests(scrim_id) WHERE status = 'pending';
CREATE INDEX idx_scrim_conf_team ON scrim_confirmation_requests(team_id) WHERE status = 'pending';

-- Migrate existing pending_confirmation scrims into the new table
INSERT INTO scrim_confirmation_requests (scrim_id, team_id, user_id, status, created_at)
SELECT id, pending_team_id, pending_user_id, 'pending', COALESCE(pending_at, NOW())
FROM scrim_requests
WHERE status = 'pending_confirmation'
  AND pending_team_id IS NOT NULL
  AND pending_user_id IS NOT NULL;

-- Reset those scrims back to open
UPDATE scrim_requests
SET status = 'open',
    pending_team_id = NULL, pending_user_id = NULL, pending_at = NULL,
    dm_channel_id = NULL, confirmation_dm_id = NULL,
    updated_at = NOW()
WHERE status = 'pending_confirmation';

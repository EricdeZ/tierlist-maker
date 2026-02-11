-- Migration 007: Match Scheduling
-- Adds scheduled_matches table and match_schedule permission for Owner + Admin roles.

-- 1. Create the scheduled_matches table
CREATE TABLE IF NOT EXISTS scheduled_matches (
    id              SERIAL PRIMARY KEY,
    season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team1_id        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    best_of         INTEGER NOT NULL DEFAULT 1,
    scheduled_date  DATE NOT NULL,
    week            INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_scheduled_match_status CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    CONSTRAINT chk_different_teams CHECK (team1_id != team2_id)
);

-- 2. Index for efficient queries by season + date
CREATE INDEX IF NOT EXISTS idx_scheduled_matches_season_date
    ON scheduled_matches (season_id, scheduled_date);

-- 3. Add match_schedule permission to Owner role
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'match_schedule'
FROM roles r
WHERE r.name = 'Owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 4. Add match_schedule permission to Admin role
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'match_schedule'
FROM roles r
WHERE r.name = 'Admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;
